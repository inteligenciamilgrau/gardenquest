param (
    [Parameter(Mandatory=$false)]
    [string]$ProjectId = "",

    [string]$EnvFile = "",
    [string]$Region = "",
    [string]$AppEnv = "",
    [string]$GoogleClientId = "",
    [string]$GoogleClientSecret = "",
    [string]$JwtSecret = "",
    [string]$AdminGoogleEmails = "",
    [string]$SupabaseDbUrl = "",
    [string]$SupabaseDbSslCaPath = "",
    [string]$OpenAiApiKeySecretName = "",
    [string]$OpenAiApiKeySecretVersion = "",
    [string]$JwtSecretSecretName = "",
    [string]$JwtSecretSecretVersion = "",
    [string]$SupabaseDbUrlSecretName = "",
    [string]$SupabaseDbUrlSecretVersion = "",
    [string]$GoogleClientSecretSecretName = "",
    [string]$GoogleClientSecretSecretVersion = "",
    [string]$BackendServiceName = "",
    [string]$FrontendServiceName = "",
    [string]$LocalBackendUrl = ""
)

$ErrorActionPreference = "Stop"

function Require-ConfigValue {
    param (
        [Parameter(Mandatory=$true)]
        [string]$Name,

        [Parameter(Mandatory=$false)]
        [string]$Value
    )

    if (-not $Value) {
        throw "$Name is required for deploy."
    }
}

if (-not $EnvFile) {
    if (Test-Path ".env.production") {
        $EnvFile = ".env.production"
    } elseif (Test-Path ".env") {
        $EnvFile = ".env"
    }
}

if ($EnvFile -and -not (Test-Path $EnvFile)) {
    throw "Env file not found: $EnvFile"
}

if ($EnvFile) {
    Write-Host "Loading configuration from $EnvFile..."
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^(?<name>[^#\s][^=]*)=(?<value>.*)$') {
            $name = $Matches['name'].Trim()
            $value = $Matches['value'].Trim()

            if ($name -eq "APP_ENV" -and -not $AppEnv) { $AppEnv = $value }
            if ($name -eq "PROJECT_ID" -and -not $ProjectId) { $ProjectId = $value }
            if ($name -eq "REGION" -and -not $Region) { $Region = $value }
            if ($name -eq "GOOGLE_CLIENT_ID" -and -not $GoogleClientId) { $GoogleClientId = $value }
            if ($name -eq "GOOGLE_CLIENT_SECRET" -and -not $GoogleClientSecret) { $GoogleClientSecret = $value }
            if ($name -eq "JWT_SECRET" -and -not $JwtSecret) { $JwtSecret = $value }
            if ($name -eq "ADMIN_GOOGLE_EMAILS" -and -not $AdminGoogleEmails) { $AdminGoogleEmails = $value }
            if ($name -eq "SUPABASE_DB_URL" -and -not $SupabaseDbUrl) { $SupabaseDbUrl = $value }
            if ($name -eq "SUPABASE_DB_SSL_CA_PATH" -and -not $SupabaseDbSslCaPath) { $SupabaseDbSslCaPath = $value }
            if ($name -eq "OPENAI_API_KEY_SECRET_NAME" -and -not $OpenAiApiKeySecretName) { $OpenAiApiKeySecretName = $value }
            if ($name -eq "OPENAI_API_KEY_SECRET_VERSION" -and -not $OpenAiApiKeySecretVersion) { $OpenAiApiKeySecretVersion = $value }
            if ($name -eq "JWT_SECRET_SECRET_NAME" -and -not $JwtSecretSecretName) { $JwtSecretSecretName = $value }
            if ($name -eq "JWT_SECRET_SECRET_VERSION" -and -not $JwtSecretSecretVersion) { $JwtSecretSecretVersion = $value }
            if ($name -eq "SUPABASE_DB_URL_SECRET_NAME" -and -not $SupabaseDbUrlSecretName) { $SupabaseDbUrlSecretName = $value }
            if ($name -eq "SUPABASE_DB_URL_SECRET_VERSION" -and -not $SupabaseDbUrlSecretVersion) { $SupabaseDbUrlSecretVersion = $value }
            if ($name -eq "GOOGLE_CLIENT_SECRET_SECRET_NAME" -and -not $GoogleClientSecretSecretName) { $GoogleClientSecretSecretName = $value }
            if ($name -eq "GOOGLE_CLIENT_SECRET_SECRET_VERSION" -and -not $GoogleClientSecretSecretVersion) { $GoogleClientSecretSecretVersion = $value }
            if ($name -eq "BACKEND_SERVICE_NAME" -and -not $BackendServiceName) { $BackendServiceName = $value }
            if ($name -eq "FRONTEND_SERVICE_NAME" -and -not $FrontendServiceName) { $FrontendServiceName = $value }
        }
    }
}

if (-not $Region) { $Region = "southamerica-east1" }
if (-not $AppEnv) { $AppEnv = "production" }
if (-not $BackendServiceName) { $BackendServiceName = "gardenquest-api" }
if (-not $FrontendServiceName) { $FrontendServiceName = "gardenquest-web" }
if (-not $OpenAiApiKeySecretVersion) { $OpenAiApiKeySecretVersion = "1" }
if (-not $JwtSecretSecretVersion) { $JwtSecretSecretVersion = "1" }
if (-not $SupabaseDbUrlSecretVersion) { $SupabaseDbUrlSecretVersion = "1" }
if (-not $GoogleClientSecretSecretVersion) { $GoogleClientSecretSecretVersion = "1" }
if (-not $ProjectId) {
    Write-Error "ProjectId is required. Set it in .env or pass as -ProjectId"
    exit
}

Require-ConfigValue -Name "GOOGLE_CLIENT_ID" -Value $GoogleClientId
Require-ConfigValue -Name "ADMIN_GOOGLE_EMAILS" -Value $AdminGoogleEmails

if (-not $JwtSecretSecretName) {
    Require-ConfigValue -Name "JWT_SECRET" -Value $JwtSecret
}

if (-not $SupabaseDbUrlSecretName) {
    Require-ConfigValue -Name "SUPABASE_DB_URL" -Value $SupabaseDbUrl
}

if (-not $GoogleClientSecretSecretName) {
    Require-ConfigValue -Name "GOOGLE_CLIENT_SECRET" -Value $GoogleClientSecret
}

Write-Host "----------------------------------"
Write-Host "  Garden Quest -- Cloud Run Deploy"
Write-Host "  Project: $ProjectId"
Write-Host "  Region:  $Region"
Write-Host "----------------------------------"

gcloud config set project $ProjectId

Write-Host ""
Write-Host "Deploying Backend..."
Push-Location backend

$BackendEnvVarList = @(
    "NODE_ENV=production",
    "APP_ENV=$AppEnv",
    "GOOGLE_CLIENT_ID=$GoogleClientId",
    "ADMIN_GOOGLE_EMAILS=$AdminGoogleEmails",
    "SUPABASE_DB_SSL=true",
    "COOKIE_SAME_SITE=Lax"
)

if ($SupabaseDbSslCaPath) {
    $BackendEnvVarList += "SUPABASE_DB_SSL_CA_PATH=$SupabaseDbSslCaPath"
}

if ($GoogleClientSecretSecretName) {
    Write-Host "Binding GOOGLE_CLIENT_SECRET from Secret Manager: ${GoogleClientSecretSecretName}:${GoogleClientSecretSecretVersion}"
} else {
    $BackendEnvVarList += "GOOGLE_CLIENT_SECRET=$GoogleClientSecret"
}

if ($JwtSecretSecretName) {
    Write-Host "Binding JWT_SECRET from Secret Manager: ${JwtSecretSecretName}:${JwtSecretSecretVersion}"
} else {
    $BackendEnvVarList += "JWT_SECRET=$JwtSecret"
}

if ($OpenAiApiKeySecretName) {
    Write-Host "Binding OPENAI_API_KEY from Secret Manager: ${OpenAiApiKeySecretName}:${OpenAiApiKeySecretVersion}"
} else {
    Write-Host "OPENAI_API_KEY secret not configured for Cloud Run. Backend will keep fallback AI behavior."
}
$BackendSecretList = @()

if ($GoogleClientSecretSecretName) {
    $BackendSecretList += "GOOGLE_CLIENT_SECRET=${GoogleClientSecretSecretName}:${GoogleClientSecretSecretVersion}"
}

if ($JwtSecretSecretName) {
    $BackendSecretList += "JWT_SECRET=${JwtSecretSecretName}:${JwtSecretSecretVersion}"
}

if ($SupabaseDbUrlSecretName) {
    Write-Host "Binding SUPABASE_DB_URL from Secret Manager: ${SupabaseDbUrlSecretName}:${SupabaseDbUrlSecretVersion}"
    $BackendSecretList += "SUPABASE_DB_URL=${SupabaseDbUrlSecretName}:${SupabaseDbUrlSecretVersion}"
} else {
    $BackendEnvVarList += "SUPABASE_DB_URL=$SupabaseDbUrl"
}

if ($OpenAiApiKeySecretName) {
    $BackendSecretList += "OPENAI_API_KEY=${OpenAiApiKeySecretName}:${OpenAiApiKeySecretVersion}"
}

$BackendEnvVars = $BackendEnvVarList -join ","

$BackendDeployArgs = @(
    "run",
    "deploy",
    $BackendServiceName,
    "--source",
    ".",
    "--region",
    $Region,
    "--platform",
    "managed",
    "--allow-unauthenticated",
    "--port",
    "8080",
    "--memory",
    "256Mi",
    "--cpu",
    "1",
    "--min-instances",
    "0",
    "--max-instances",
    "1",
    "--set-env-vars",
    $BackendEnvVars
)

if ($BackendSecretList.Count -gt 0) {
    $BackendDeployArgs += @(
        "--update-secrets",
        ($BackendSecretList -join ",")
    )
}

& gcloud @BackendDeployArgs

$BackendUrl = gcloud run services describe $BackendServiceName --region $Region --format='value(status.url)'
Write-Host "Backend: $BackendUrl"
Pop-Location

Write-Host ""
Write-Host "Deploying Frontend..."
Push-Location frontend

$FrontendEnvVars = "BACKEND_UPSTREAM=$BackendUrl"

gcloud run deploy $FrontendServiceName `
    --source . `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --port 8080 `
    --memory 128Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 5 `
    --set-env-vars $FrontendEnvVars

$FrontendUrl = gcloud run services describe $FrontendServiceName --region $Region --format='value(status.url)'
Write-Host "Frontend: $FrontendUrl"
Pop-Location

Write-Host ""
Write-Host "Updating Backend callback and frontend URL..."
$FinalBackendEnvVars = @(
    "FRONTEND_URL=$FrontendUrl",
    "GOOGLE_REDIRECT_URI=$FrontendUrl/auth/callback",
    "COOKIE_SAME_SITE=Lax"
) -join ","

gcloud run services update $BackendServiceName `
    --region $Region `
    --update-env-vars $FinalBackendEnvVars

Write-Host ""
Write-Host "----------------------------------"
Write-Host "  Deploy Complete"
Write-Host "----------------------------------"
Write-Host ""
Write-Host "  Frontend URL: $FrontendUrl"
Write-Host "  Backend URL:  $BackendUrl"
Write-Host ""
Write-Host "  Action required in Google Cloud Console:"
Write-Host "  1. Authorized JavaScript origins:"
Write-Host "     $FrontendUrl"
Write-Host ""
Write-Host "  2. Authorized redirect URIs:"
Write-Host "     $FrontendUrl/auth/callback"
Write-Host ""
Write-Host "----------------------------------"
