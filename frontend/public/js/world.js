const HOUSE_LAYOUT = Object.freeze({
    position: Object.freeze({ x: 0, y: 0, z: 20 }),
    width: 8.5,
    depth: 7,
    wallHeight: 5.2,
    wallThickness: 0.35,
    doorWidth: 2.4,
    doorHeight: 3.6,
});

const DEFAULT_SOCCER_FIELD_LAYOUT = Object.freeze({
    position: Object.freeze({ x: 0, y: 0, z: -31 }),
    width: 18,
    depth: 28,
    grandstandSide: 'east',
    grandstandSidelineGap: 3.8,
    grandstandLengthPadding: 4.8,
    grandstandTiers: 4,
    grandstandTierHeight: 0.58,
    grandstandTierDepth: 1.25,
});

const TREE_POSITIONS = Object.freeze([
    Object.freeze({ x: -24, z: -8 }),
    Object.freeze({ x: -16, z: 8 }),
    Object.freeze({ x: 16, z: 9 }),
    Object.freeze({ x: 26, z: -6 }),
    Object.freeze({ x: -26, z: 18 }),
    Object.freeze({ x: 20, z: 20 }),
    Object.freeze({ x: -18, z: 30 }),
    Object.freeze({ x: 28, z: 8 }),
]);

const DEFAULT_SOCCER_GRANDSTAND_LAYOUT = Object.freeze({
    side: 'east',
    sidelineGap: 3.8,
    lengthPadding: 4.8,
    tiers: 4,
    tierHeight: 0.58,
    tierDepth: 1.25,
});

const PLAYER_COLLISION_RADIUS = 0.45;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function clonePoint(point) {
    return {
        x: Number(point?.x) || 0,
        y: Number(point?.y) || 0,
        z: Number(point?.z) || 0,
    };
}

function buildHouseWallCollisionBoxes(layout = HOUSE_LAYOUT) {
    const halfWidth = layout.width / 2;
    const halfDepth = layout.depth / 2;
    const halfDoorWidth = layout.doorWidth / 2;
    const wallThickness = layout.wallThickness;
    const southEdge = layout.position.z - halfDepth;
    const northEdge = layout.position.z + halfDepth;
    const westEdge = layout.position.x - halfWidth;
    const eastEdge = layout.position.x + halfWidth;

    return [
        {
            minX: westEdge,
            maxX: eastEdge,
            minZ: northEdge - wallThickness,
            maxZ: northEdge,
        },
        {
            minX: westEdge,
            maxX: westEdge + wallThickness,
            minZ: southEdge,
            maxZ: northEdge,
        },
        {
            minX: eastEdge - wallThickness,
            maxX: eastEdge,
            minZ: southEdge,
            maxZ: northEdge,
        },
        {
            minX: westEdge,
            maxX: layout.position.x - halfDoorWidth,
            minZ: southEdge,
            maxZ: southEdge + wallThickness,
        },
        {
            minX: layout.position.x + halfDoorWidth,
            maxX: eastEdge,
            minZ: southEdge,
            maxZ: southEdge + wallThickness,
        },
    ];
}

function isPointInsideRect(point, rect, padding = 0) {
    return (
        point.x >= rect.minX - padding &&
        point.x <= rect.maxX + padding &&
        point.z >= rect.minZ - padding &&
        point.z <= rect.maxZ + padding
    );
}

function buildSoccerGrandstandLayout(fieldState = DEFAULT_SOCCER_FIELD_LAYOUT) {
    const centerX = Number(fieldState?.position?.x) || 0;
    const centerZ = Number(fieldState?.position?.z) || 0;
    const fieldWidth = Number(fieldState?.width) || DEFAULT_SOCCER_FIELD_LAYOUT.width;
    const fieldDepth = Number(fieldState?.depth) || DEFAULT_SOCCER_FIELD_LAYOUT.depth;
    const side = fieldState?.grandstandSide === 'west' ? 'west' : DEFAULT_SOCCER_GRANDSTAND_LAYOUT.side;
    const sideMultiplier = side === 'west' ? -1 : 1;
    const sidelineGap = Number(fieldState?.grandstandSidelineGap) || DEFAULT_SOCCER_GRANDSTAND_LAYOUT.sidelineGap;
    const lengthPadding = Number(fieldState?.grandstandLengthPadding) || DEFAULT_SOCCER_GRANDSTAND_LAYOUT.lengthPadding;
    const tiers = Math.max(1, Math.trunc(Number(fieldState?.grandstandTiers) || DEFAULT_SOCCER_GRANDSTAND_LAYOUT.tiers));
    const tierHeight = Number(fieldState?.grandstandTierHeight) || DEFAULT_SOCCER_GRANDSTAND_LAYOUT.tierHeight;
    const tierDepth = Number(fieldState?.grandstandTierDepth) || DEFAULT_SOCCER_GRANDSTAND_LAYOUT.tierDepth;
    const depth = (tiers * tierDepth) + 0.6;
    const length = fieldDepth + lengthPadding;
    const frontX = centerX + sideMultiplier * ((fieldWidth / 2) + sidelineGap);
    const backX = frontX + sideMultiplier * depth;

    return {
        centerX: frontX + sideMultiplier * (depth / 2),
        centerZ,
        side,
        sidelineGap,
        lengthPadding,
        tiers,
        tierHeight,
        tierDepth,
        depth,
        length,
        frontX,
        backX,
        sideMultiplier,
        minX: Math.min(frontX, backX),
        maxX: Math.max(frontX, backX),
        minZ: centerZ - (length / 2),
        maxZ: centerZ + (length / 2),
    };
}

function buildSoccerGrandstandFootprint(fieldState = DEFAULT_SOCCER_FIELD_LAYOUT, padding = 0) {
    const layout = buildSoccerGrandstandLayout(fieldState);

    return {
        minX: Math.min(layout.frontX, layout.backX) - padding,
        maxX: Math.max(layout.frontX, layout.backX) + padding,
        minZ: layout.minZ - padding,
        maxZ: layout.maxZ + padding,
    };
}

function buildSoccerGrandstandCollisionBoxes(fieldState = DEFAULT_SOCCER_FIELD_LAYOUT) {
    const layout = buildSoccerGrandstandLayout(fieldState);
    const backWallThickness = 0.3;
    const endWallThickness = 0.22;

    return [
        {
            minX: Math.min(layout.backX, layout.backX + (layout.sideMultiplier * backWallThickness)),
            maxX: Math.max(layout.backX, layout.backX + (layout.sideMultiplier * backWallThickness)),
            minZ: layout.minZ - 0.08,
            maxZ: layout.maxZ + 0.08,
        },
        {
            minX: layout.minX - 0.08,
            maxX: layout.maxX + 0.08,
            minZ: layout.minZ - endWallThickness,
            maxZ: layout.minZ,
        },
        {
            minX: layout.minX - 0.08,
            maxX: layout.maxX + 0.08,
            minZ: layout.maxZ,
            maxZ: layout.maxZ + endWallThickness,
        },
    ];
}

function buildSoccerGrandstandStepSurfaces(fieldState = DEFAULT_SOCCER_FIELD_LAYOUT) {
    const layout = buildSoccerGrandstandLayout(fieldState);
    const surfaces = [];

    for (let tierIndex = 0; tierIndex < layout.tiers; tierIndex++) {
        const tierStartX = layout.frontX + (layout.sideMultiplier * (tierIndex * layout.tierDepth));
        const tierEndX = layout.frontX + (layout.sideMultiplier * ((tierIndex + 1) * layout.tierDepth));
        surfaces.push({
            minX: Math.min(tierStartX, tierEndX),
            maxX: Math.max(tierStartX, tierEndX),
            minZ: layout.minZ + 0.18,
            maxZ: layout.maxZ - 0.18,
            height: (tierIndex + 1) * layout.tierHeight,
        });
    }

    return surfaces;
}

class World {
    constructor(scene) {
        this.scene = scene;
        this.trees = [];
        this.apples = [];
        this.applesByTree = new Map();
        this.looseApples = new Map();
        this.graves = new Map();
        this.soccerFieldGroup = null;
        this.soccerBall = null;
        this.soccerBallTargetPosition = new THREE.Vector3();
        this.soccerBallInitialized = false;
        this.soccerBallPossessed = false;
        this.soccerBallCarrierState = null;
        this.soccerFieldMetrics = null;
        this.soccerGrandstandCollisionBoxes = buildSoccerGrandstandCollisionBoxes();
        this.soccerGrandstandStepSurfaces = buildSoccerGrandstandStepSurfaces();
        this.soccerFieldSignature = '';
        this.soccerGoalBanner = null;
        this.soccerGoalBannerVisibleUntil = 0;
        this.appleOffsets = [
            { x: 1.55, y: 3.85, z: 0.75 },
            { x: -1.35, y: 4.15, z: 0.95 },
            { x: 0.95, y: 4.55, z: -1.3 },
            { x: -0.35, y: 4.85, z: -0.95 },
            { x: 0.25, y: 3.75, z: 1.45 },
            { x: -1.55, y: 4.45, z: -0.15 },
        ];
        this.lakePosition = new THREE.Vector3(0, 0, 0);
        this.lakeRadius = 6;
        this.bounds = 45;
        this.houseLayout = HOUSE_LAYOUT;
        this.houseWallCollisionBoxes = buildHouseWallCollisionBoxes(this.houseLayout);
        this.soccerGrandstandCollisionBoxes = buildSoccerGrandstandCollisionBoxes();
        this.soccerGrandstandStepSurfaces = buildSoccerGrandstandStepSurfaces();

        this._createGround();
        this._createSky();
        this._createLighting();
        this._createHouse();
        this._createLake();
        this._createTrees();
        this._createDecorations();
    }

    _getSoccerFieldSignature(fieldState) {
        return [
            Number(fieldState?.position?.x) || 0,
            Number(fieldState?.position?.z) || 0,
            Number(fieldState?.width) || 0,
            Number(fieldState?.depth) || 0,
            Number(fieldState?.goalWidth) || 0,
            Number(fieldState?.goalDepth) || 0,
            Number(fieldState?.goalHeight) || 0,
            Number(fieldState?.postThickness) || 0,
            Number(fieldState?.lineWidth) || 0,
            Number(fieldState?.ballRadius) || 0,
            String(fieldState?.grandstandSide || DEFAULT_SOCCER_GRANDSTAND_LAYOUT.side),
            Number(fieldState?.grandstandSidelineGap) || DEFAULT_SOCCER_GRANDSTAND_LAYOUT.sidelineGap,
            Number(fieldState?.grandstandLengthPadding) || DEFAULT_SOCCER_GRANDSTAND_LAYOUT.lengthPadding,
            Number(fieldState?.grandstandTiers) || DEFAULT_SOCCER_GRANDSTAND_LAYOUT.tiers,
            Number(fieldState?.grandstandTierHeight) || DEFAULT_SOCCER_GRANDSTAND_LAYOUT.tierHeight,
            Number(fieldState?.grandstandTierDepth) || DEFAULT_SOCCER_GRANDSTAND_LAYOUT.tierDepth,
        ].join(':');
    }

    _getSoccerFieldMetrics(fieldState, ballState) {
        const radius = Number(ballState?.radius) || Number(fieldState?.ballRadius) || 0.42;
        const centerX = Number(fieldState?.position?.x) || 0;
        const centerZ = Number(fieldState?.position?.z) || 0;
        const halfWidth = (Number(fieldState?.width) || 18) / 2;
        const halfDepth = (Number(fieldState?.depth) || 28) / 2;

        return {
            radius,
            xMin: centerX - halfWidth + radius,
            xMax: centerX + halfWidth - radius,
            zMin: centerZ - halfDepth + radius,
            zMax: centerZ + halfDepth - radius,
        };
    }

    _clampSoccerBallTargetInsideField(targetPosition) {
        if (!this.soccerFieldMetrics) {
            return targetPosition;
        }

        return {
            x: clamp(Number(targetPosition?.x) || 0, this.soccerFieldMetrics.xMin, this.soccerFieldMetrics.xMax),
            y: Number(targetPosition?.y) || this.soccerFieldMetrics.radius,
            z: clamp(Number(targetPosition?.z) || 0, this.soccerFieldMetrics.zMin, this.soccerFieldMetrics.zMax),
        };
    }

    _disposeSoccerField() {
        if (!this.soccerFieldGroup) {
            return;
        }

        this.soccerFieldGroup.traverse((child) => {
            if (child.material) {
                child.material.dispose();
            }

            if (child.geometry) {
                child.geometry.dispose();
            }
        });

        this.scene.remove(this.soccerFieldGroup);
        this.soccerFieldGroup = null;
        this.soccerBall = null;
        this.soccerBallInitialized = false;
        this.soccerBallPossessed = false;
        this.soccerBallCarrierState = null;
        this.soccerFieldMetrics = null;
        this.soccerFieldSignature = '';
        this.soccerGoalBanner = null;
        this.soccerGoalBannerVisibleUntil = 0;
    }

    _addSoccerLine(parent, width, depth, x, z, material) {
        const line = new THREE.Mesh(
            new THREE.BoxGeometry(width, 0.02, depth),
            material
        );
        line.position.set(x, 0.05, z);
        line.receiveShadow = true;
        parent.add(line);
    }

    _createGoalFrame(fieldState, side, material) {
        const goal = new THREE.Group();
        const postThickness = Number(fieldState?.postThickness) || 0.18;
        const goalWidth = Number(fieldState?.goalWidth) || 6.8;
        const goalDepth = Number(fieldState?.goalDepth) || 2.8;
        const goalHeight = Number(fieldState?.goalHeight) || 2.5;
        const fieldZ = Number(fieldState?.position?.z) || 0;
        const fieldHalfDepth = (Number(fieldState?.depth) || 28) / 2;
        const frontZ = side === 'north'
            ? fieldZ - fieldHalfDepth
            : fieldZ + fieldHalfDepth;
        const backOffset = side === 'north'
            ? -goalDepth / 2
            : goalDepth / 2;
        const innerGoalWidth = Math.max(goalWidth - postThickness, 0.1);
        const innerGoalDepth = Math.max(goalDepth - postThickness, 0.1);
        const sideNetOffsetX = (goalWidth / 2) - (postThickness / 2);
        const backNetZ = (backOffset * 2) - (Math.sign(backOffset) * (postThickness / 2));

        const leftPost = new THREE.Mesh(
            new THREE.BoxGeometry(postThickness, goalHeight, postThickness),
            material
        );
        leftPost.position.set(-(goalWidth / 2), goalHeight / 2, 0);
        leftPost.castShadow = true;
        leftPost.receiveShadow = true;
        goal.add(leftPost);

        const rightPost = leftPost.clone();
        rightPost.position.x = goalWidth / 2;
        goal.add(rightPost);

        const crossbar = new THREE.Mesh(
            new THREE.BoxGeometry(goalWidth + postThickness, postThickness, postThickness),
            material
        );
        crossbar.position.set(0, goalHeight, 0);
        crossbar.castShadow = true;
        crossbar.receiveShadow = true;
        goal.add(crossbar);

        const backbar = crossbar.clone();
        backbar.position.z = backOffset * 2;
        goal.add(backbar);

        const leftBack = new THREE.Mesh(
            new THREE.BoxGeometry(postThickness, goalHeight, postThickness),
            material
        );
        leftBack.position.set(-(goalWidth / 2), goalHeight / 2, backOffset * 2);
        leftBack.castShadow = true;
        leftBack.receiveShadow = true;
        goal.add(leftBack);

        const rightBack = leftBack.clone();
        rightBack.position.x = goalWidth / 2;
        goal.add(rightBack);

        const netMaterial = new THREE.MeshLambertMaterial({
            color: 0xf8fafc,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide,
        });

        const backNet = new THREE.Mesh(
            new THREE.PlaneGeometry(innerGoalWidth, goalHeight),
            netMaterial
        );
        backNet.position.set(0, goalHeight / 2, backNetZ);
        goal.add(backNet);

        const sideNetGeometry = new THREE.PlaneGeometry(innerGoalDepth, goalHeight);
        const leftNet = new THREE.Mesh(sideNetGeometry, netMaterial.clone());
        leftNet.position.set(-sideNetOffsetX, goalHeight / 2, backOffset);
        leftNet.rotation.y = Math.PI / 2;
        goal.add(leftNet);

        const rightNet = new THREE.Mesh(sideNetGeometry, netMaterial.clone());
        rightNet.position.set(sideNetOffsetX, goalHeight / 2, backOffset);
        rightNet.rotation.y = Math.PI / 2;
        goal.add(rightNet);

        goal.position.set(Number(fieldState?.position?.x) || 0, 0, frontZ);
        return goal;
    }

    _createSoccerGrandstand(fieldState) {
        const layout = buildSoccerGrandstandLayout(fieldState);
        const grandstand = new THREE.Group();
        const concreteMaterial = new THREE.MeshLambertMaterial({ color: 0xc9ced6 });
        const seatMaterial = new THREE.MeshLambertMaterial({ color: 0xa16207 });
        const railMaterial = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
        const bannerMaterial = new THREE.MeshLambertMaterial({ color: 0x1d4ed8 });
        const crowdPalette = [0xef4444, 0xf59e0b, 0x2563eb, 0x16a34a, 0xe11d48, 0x7c3aed, 0x0f766e];
        const topStepHeight = layout.tiers * layout.tierHeight;

        const base = new THREE.Mesh(
            new THREE.BoxGeometry(layout.depth + 0.55, 0.16, layout.length + 0.8),
            concreteMaterial
        );
        base.position.set(layout.centerX, 0.08, layout.centerZ);
        base.castShadow = true;
        base.receiveShadow = true;
        grandstand.add(base);

        for (let tier = 0; tier < layout.tiers; tier++) {
            const stepHeight = (tier + 1) * layout.tierHeight;
            const step = new THREE.Mesh(
                new THREE.BoxGeometry(layout.tierDepth, stepHeight, layout.length - 0.7),
                concreteMaterial
            );
            step.position.set(
                layout.frontX + (layout.sideMultiplier * ((tier + 0.5) * layout.tierDepth)),
                stepHeight / 2,
                layout.centerZ
            );
            step.castShadow = true;
            step.receiveShadow = true;
            grandstand.add(step);

            const seat = new THREE.Mesh(
                new THREE.BoxGeometry(layout.tierDepth * 0.76, 0.12, layout.length - 1.5),
                seatMaterial
            );
            seat.position.set(
                layout.frontX + (layout.sideMultiplier * ((tier + 0.72) * layout.tierDepth)),
                stepHeight + 0.1,
                layout.centerZ
            );
            seat.castShadow = true;
            seat.receiveShadow = true;
            grandstand.add(seat);
        }

        const backWallHeight = topStepHeight + 1.1;
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, backWallHeight, layout.length + 0.4),
            concreteMaterial
        );
        backWall.position.set(
            layout.backX + (layout.sideMultiplier * 0.11),
            backWallHeight / 2,
            layout.centerZ
        );
        backWall.castShadow = true;
        backWall.receiveShadow = true;
        grandstand.add(backWall);

        for (let side = -1; side <= 1; side += 2) {
            const endRail = new THREE.Mesh(
                new THREE.BoxGeometry(layout.depth + 0.2, 1.05, 0.12),
                railMaterial
            );
            endRail.position.set(
                layout.centerX,
                topStepHeight + 0.55,
                layout.centerZ + side * ((layout.length / 2) - 0.06)
            );
            endRail.castShadow = true;
            grandstand.add(endRail);
        }

        const backRailX = layout.backX - (layout.sideMultiplier * 0.16);
        for (let railIndex = 0; railIndex < 12; railIndex++) {
            const t = railIndex / 11;
            const z = THREE.MathUtils.lerp(layout.minZ + 0.5, layout.maxZ - 0.5, t);

            const post = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 1.1, 0.08),
                railMaterial
            );
            post.position.set(backRailX, topStepHeight + 0.48, z);
            post.castShadow = true;
            grandstand.add(post);
        }

        const handrail = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.1, layout.length - 0.8),
            railMaterial
        );
        handrail.position.set(backRailX, topStepHeight + 0.98, layout.centerZ);
        handrail.castShadow = true;
        grandstand.add(handrail);

        const banner = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 1.05, Math.min(layout.length - 3.2, 9.2)),
            bannerMaterial
        );
        banner.position.set(
            layout.backX - (layout.sideMultiplier * 0.14),
            topStepHeight + 1.4,
            layout.centerZ
        );
        banner.castShadow = true;
        grandstand.add(banner);

        const crowdSpacing = (layout.length - 3.4) / 7;
        for (let tier = 0; tier < layout.tiers; tier++) {
            for (let seatIndex = 0; seatIndex < 8; seatIndex++) {
                const spectator = new THREE.Group();
                const paletteIndex = (tier * 3 + seatIndex) % crowdPalette.length;
                const shirtMaterial = new THREE.MeshLambertMaterial({ color: crowdPalette[paletteIndex] });
                const body = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.18, 0.2, 0.42, 8),
                    shirtMaterial
                );
                body.castShadow = true;
                spectator.add(body);

                const head = new THREE.Mesh(
                    new THREE.SphereGeometry(0.12, 12, 12),
                    new THREE.MeshLambertMaterial({ color: 0xf1c27d })
                );
                head.position.y = 0.34;
                head.castShadow = true;
                spectator.add(head);

                const stepHeight = (tier + 1) * layout.tierHeight;
                spectator.position.set(
                    layout.frontX + (layout.sideMultiplier * ((tier + 0.52) * layout.tierDepth)),
                    stepHeight + 0.34,
                    layout.minZ + 1.7 + (seatIndex * crowdSpacing)
                );
                grandstand.add(spectator);
            }
        }

        return grandstand;
    }

    _createSoccerField(soccerState) {
        const fieldState = soccerState?.field || {};
        const fieldGroup = new THREE.Group();
        const centerX = Number(fieldState?.position?.x) || 0;
        const centerZ = Number(fieldState?.position?.z) || 0;
        const fieldWidth = Number(fieldState?.width) || 18;
        const fieldDepth = Number(fieldState?.depth) || 28;
        const lineWidth = Number(fieldState?.lineWidth) || 0.18;
        const ballRadius = Number(fieldState?.ballRadius) || 0.42;

        const grass = new THREE.Mesh(
            new THREE.PlaneGeometry(fieldWidth, fieldDepth),
            new THREE.MeshLambertMaterial({ color: 0x2b7f46 })
        );
        grass.rotation.x = -Math.PI / 2;
        grass.position.set(centerX, 0.04, centerZ);
        grass.receiveShadow = true;
        fieldGroup.add(grass);

        const lineMaterial = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
        this._addSoccerLine(fieldGroup, fieldWidth, lineWidth, centerX, centerZ - (fieldDepth / 2), lineMaterial);
        this._addSoccerLine(fieldGroup, fieldWidth, lineWidth, centerX, centerZ + (fieldDepth / 2), lineMaterial);
        this._addSoccerLine(fieldGroup, lineWidth, fieldDepth, centerX - (fieldWidth / 2), centerZ, lineMaterial);
        this._addSoccerLine(fieldGroup, lineWidth, fieldDepth, centerX + (fieldWidth / 2), centerZ, lineMaterial);
        this._addSoccerLine(fieldGroup, fieldWidth, lineWidth, centerX, centerZ, lineMaterial);

        const centerCircle = new THREE.Mesh(
            new THREE.RingGeometry(2.1, 2.3, 48),
            lineMaterial
        );
        centerCircle.rotation.x = -Math.PI / 2;
        centerCircle.position.set(centerX, 0.055, centerZ);
        fieldGroup.add(centerCircle);

        const goalMaterial = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
        fieldGroup.add(this._createGoalFrame(fieldState, 'north', goalMaterial));
        fieldGroup.add(this._createGoalFrame(fieldState, 'south', goalMaterial));
        fieldGroup.add(this._createSoccerGrandstand(fieldState));

        const ball = new THREE.Mesh(
            new THREE.SphereGeometry(ballRadius, 20, 20),
            new THREE.MeshPhongMaterial({
                color: 0xf8fafc,
                shininess: 80,
                specular: 0xffffff,
            })
        );
        ball.castShadow = true;
        ball.receiveShadow = true;
        ball.position.set(centerX, ballRadius, centerZ);
        fieldGroup.add(ball);

        const goalBanner = this._createSoccerGoalBanner(fieldState);
        fieldGroup.add(goalBanner);

        this.soccerFieldGroup = fieldGroup;
        this.soccerBall = ball;
        this.soccerGoalBanner = goalBanner;
        this.soccerBallTargetPosition.set(centerX, ballRadius, centerZ);
        this.soccerBallInitialized = false;
        this.soccerFieldMetrics = this._getSoccerFieldMetrics(fieldState, soccerState?.ball);
        this.soccerGrandstandCollisionBoxes = buildSoccerGrandstandCollisionBoxes(fieldState);
        this.soccerGrandstandStepSurfaces = buildSoccerGrandstandStepSurfaces(fieldState);
        this.soccerFieldSignature = this._getSoccerFieldSignature(fieldState);
        this.scene.add(fieldGroup);
    }

    syncSoccerState(soccerState) {
        if (!soccerState?.field || !soccerState?.ball) {
            return;
        }

        const nextSignature = this._getSoccerFieldSignature(soccerState.field);
        if (!this.soccerFieldGroup || this.soccerFieldSignature !== nextSignature) {
            this._disposeSoccerField();
            this._createSoccerField(soccerState);
        }

        this.soccerFieldMetrics = this._getSoccerFieldMetrics(soccerState.field, soccerState.ball);
        this.soccerGrandstandCollisionBoxes = buildSoccerGrandstandCollisionBoxes(soccerState.field);
        this.soccerGrandstandStepSurfaces = buildSoccerGrandstandStepSurfaces(soccerState.field);
        const nextBallY = Number(soccerState?.ball?.position?.y) || Number(soccerState?.ball?.radius) || 0.42;
        this.soccerBallPossessed = Boolean(String(soccerState?.ball?.possessedByActorId || '').trim());
        this.soccerBallTargetPosition.set(
            Number(soccerState?.ball?.position?.x) || 0,
            nextBallY,
            Number(soccerState?.ball?.position?.z) || 0
        );

        if (this.soccerBall && !this.soccerBallInitialized) {
            this.soccerBall.position.copy(this.soccerBallTargetPosition);
            this.soccerBallInitialized = true;
        }
    }

    setSoccerBallCarrierState(carrierState) {
        this.soccerBallCarrierState = carrierState && carrierState.position
            ? {
                position: carrierState.position,
                rotationY: Number.isFinite(carrierState.rotationY) ? carrierState.rotationY : 0,
            }
            : null;
    }

    _getSoccerBallCarrierTarget(carrierState) {
        const radius = this.soccerBallTargetPosition.y || 0.42;
        const offset = PLAYER_COLLISION_RADIUS + radius + 0.12;
        const rotationY = Number.isFinite(carrierState?.rotationY) ? carrierState.rotationY : 0;
        const position = carrierState?.position || { x: 0, y: 0, z: 0 };

        return {
            x: (Number(position.x) || 0) + (Math.sin(rotationY) * offset),
            y: radius,
            z: (Number(position.z) || 0) + (Math.cos(rotationY) * offset),
        };
    }

    _buildSoccerGoalBannerTexture(playerName) {
        const scorerName = String(playerName || 'Alguem').trim().slice(0, 24) || 'Alguem';
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(3, 84, 63, 0.9)';
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.96)';
        ctx.lineWidth = 14;

        const radius = 44;
        ctx.beginPath();
        ctx.moveTo(radius, 14);
        ctx.lineTo(canvas.width - radius, 14);
        ctx.quadraticCurveTo(canvas.width - 14, 14, canvas.width - 14, radius);
        ctx.lineTo(canvas.width - 14, canvas.height - radius);
        ctx.quadraticCurveTo(canvas.width - 14, canvas.height - 14, canvas.width - radius, canvas.height - 14);
        ctx.lineTo(radius, canvas.height - 14);
        ctx.quadraticCurveTo(14, canvas.height - 14, 14, canvas.height - radius);
        ctx.lineTo(14, radius);
        ctx.quadraticCurveTo(14, 14, radius, 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#fef08a';
        ctx.font = '900 188px Outfit, sans-serif';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.34)';
        ctx.shadowBlur = 18;
        ctx.fillText('GOLLL', canvas.width / 2, 190);

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ecfeff';
        ctx.font = '700 86px Outfit, sans-serif';
        ctx.fillText(scorerName, canvas.width / 2, 348);

        ctx.fillStyle = 'rgba(226, 232, 240, 0.94)';
        ctx.font = '600 42px Outfit, sans-serif';
        ctx.fillText('marcou!', canvas.width / 2, 432);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        return texture;
    }

    _createSoccerGoalBanner(fieldState) {
        const texture = this._buildSoccerGoalBannerTexture('Alguem');
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(12.6, 6.3, 1);
        sprite.position.set(
            Number(fieldState?.position?.x) || 0,
            4.8,
            Number(fieldState?.position?.z) || 0
        );
        sprite.renderOrder = 18;
        sprite.visible = false;
        sprite.userData.texture = texture;
        sprite.userData.baseScale = { x: 12.6, y: 6.3 };
        return sprite;
    }

    _updateSoccerGoalBanner(playerName) {
        if (!this.soccerGoalBanner) {
            return;
        }

        const nextTexture = this._buildSoccerGoalBannerTexture(playerName);
        const previousTexture = this.soccerGoalBanner.userData.texture;
        this.soccerGoalBanner.material.map = nextTexture;
        this.soccerGoalBanner.userData.texture = nextTexture;
        this.soccerGoalBanner.material.needsUpdate = true;

        if (previousTexture) {
            previousTexture.dispose();
        }
    }

    showSoccerGoalBanner(goalEvent, durationMs = 3000) {
        if (!this.soccerGoalBanner) {
            return;
        }

        this._updateSoccerGoalBanner(goalEvent?.playerName);
        this.soccerGoalBanner.visible = true;
        this.soccerGoalBanner.material.opacity = 1;
        this.soccerGoalBannerVisibleUntil = performance.now() + Math.max(300, Number(durationMs) || 3000);
    }

    _buildNameplateTexture(name) {
        const labelText = String(name || 'Finado').trim().slice(0, 22) || 'Finado';
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 96;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'rgba(31, 24, 20, 0.92)';
        ctx.strokeStyle = 'rgba(214, 194, 154, 0.95)';
        ctx.lineWidth = 6;

        const radius = 18;
        ctx.beginPath();
        ctx.moveTo(radius, 6);
        ctx.lineTo(canvas.width - radius, 6);
        ctx.quadraticCurveTo(canvas.width - 6, 6, canvas.width - 6, radius);
        ctx.lineTo(canvas.width - 6, canvas.height - radius);
        ctx.quadraticCurveTo(canvas.width - 6, canvas.height - 6, canvas.width - radius, canvas.height - 6);
        ctx.lineTo(radius, canvas.height - 6);
        ctx.quadraticCurveTo(6, canvas.height - 6, 6, canvas.height - radius);
        ctx.lineTo(6, radius);
        ctx.quadraticCurveTo(6, 6, radius, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8e7c7';
        ctx.font = '700 28px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        return texture;
    }

    _createGraveNameplate(graveState) {
        const texture = this._buildNameplateTexture(graveState?.actorName);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(2.6, 0.78, 1);
        sprite.position.set(0, 1.92, 0);
        sprite.renderOrder = 12;
        sprite.userData.texture = texture;
        return sprite;
    }

    _updateGraveNameplate(marker, graveState) {
        if (!marker?.userData?.nameplate) {
            return;
        }

        const nextName = String(graveState?.actorName || 'Finado').trim() || 'Finado';
        if (marker.userData.actorName === nextName) {
            return;
        }

        const nextTexture = this._buildNameplateTexture(nextName);
        const previousTexture = marker.userData.nameplate.userData.texture;
        marker.userData.nameplate.material.map = nextTexture;
        marker.userData.nameplate.userData.texture = nextTexture;
        marker.userData.nameplate.material.needsUpdate = true;
        marker.userData.actorName = nextName;

        if (previousTexture) {
            previousTexture.dispose();
        }
    }

    _disposeGraveMarker(marker) {
        if (!marker) {
            return;
        }

        marker.traverse((child) => {
            if (child.material) {
                if (child.material.map) {
                    child.material.map.dispose();
                }
                child.material.dispose();
            }

            if (child.geometry) {
                child.geometry.dispose();
            }
        });
    }

    _createGround() {
        const groundGeo = new THREE.PlaneGeometry(100, 100, 20, 20);
        const groundMat = new THREE.MeshLambertMaterial({ color: 0x4a9e4a });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        const vertices = groundGeo.attributes.position;
        for (let i = 0; i < vertices.count; i++) {
            const z = vertices.getZ(i);
            vertices.setZ(i, z + (Math.random() - 0.5) * 0.3);
        }
        vertices.needsUpdate = true;
        groundGeo.computeVertexNormals();

        const pathGeo = new THREE.PlaneGeometry(2, 18);
        const pathMat = new THREE.MeshLambertMaterial({ color: 0xc4a56e });
        const path = new THREE.Mesh(pathGeo, pathMat);
        path.rotation.x = -Math.PI / 2;
        path.position.set(0, 0.02, 8);
        path.receiveShadow = true;
        this.scene.add(path);
    }

    _createSky() {
        const skyGeo = new THREE.SphereGeometry(80, 32, 15);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x5eb4f5) },
                bottomColor: { value: new THREE.Color(0xc8e6ff) },
                offset: { value: 10 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPos.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide,
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);

        for (let i = 0; i < 8; i++) {
            this._createCloud(
                (Math.random() - 0.5) * 80,
                25 + Math.random() * 15,
                (Math.random() - 0.5) * 80
            );
        }
    }

    _createCloud(x, y, z) {
        const cloudGroup = new THREE.Group();
        const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });

        const sizes = [
            { s: [3, 1.5, 2], p: [0, 0, 0] },
            { s: [2, 1.2, 1.8], p: [1.8, 0.2, 0.3] },
            { s: [2.5, 1.3, 1.6], p: [-1.5, 0.1, -0.2] },
            { s: [1.5, 1, 1.5], p: [0.5, 0.5, -0.5] },
        ];

        sizes.forEach(({ s, p }) => {
            const geo = new THREE.SphereGeometry(1, 8, 6);
            const mesh = new THREE.Mesh(geo, cloudMat);
            mesh.scale.set(s[0], s[1], s[2]);
            mesh.position.set(p[0], p[1], p[2]);
            cloudGroup.add(mesh);
        });

        cloudGroup.position.set(x, y, z);
        cloudGroup.userData.speed = 0.3 + Math.random() * 0.5;
        cloudGroup.userData.isCloud = true;
        this.scene.add(cloudGroup);
    }

    _createLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xfff4d6, 1.0);
        sun.position.set(20, 30, 10);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 100;
        sun.shadow.camera.left = -30;
        sun.shadow.camera.right = 30;
        sun.shadow.camera.top = 30;
        sun.shadow.camera.bottom = -30;
        this.scene.add(sun);

        const hemi = new THREE.HemisphereLight(0x87CEEB, 0x4a9e4a, 0.3);
        this.scene.add(hemi);
    }

    _createHouse() {
        const houseGroup = new THREE.Group();
        const {
            width,
            depth,
            wallHeight,
            wallThickness,
            doorWidth,
            doorHeight,
            position,
        } = this.houseLayout;
        const halfWidth = width / 2;
        const halfDepth = depth / 2;
        const sideWallZ = 0;
        const frontWallZ = -halfDepth + (wallThickness / 2);
        const backWallZ = halfDepth - (wallThickness / 2);
        const sideWallX = halfWidth - (wallThickness / 2);
        const frontWallSegmentWidth = (width - doorWidth) / 2;
        const roofRadius = Math.max(width, depth) * 0.83;
        const roofHeight = 3.2;
        const frontWindowOffsetX = halfWidth - 1.45;
        const sideWindowOffsetZ = 0.9;

        const wallMat = new THREE.MeshLambertMaterial({ color: 0xe8d5b7 });
        const trimMat = new THREE.MeshLambertMaterial({ color: 0x7a5134 });
        const roofMat = new THREE.MeshLambertMaterial({ color: 0xb04030 });
        const doorMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
        const windowMat = new THREE.MeshLambertMaterial({ color: 0x9ed8ff, transparent: true, opacity: 0.72 });
        const floorMat = new THREE.MeshLambertMaterial({ color: 0xb69062 });
        const rugMat = new THREE.MeshLambertMaterial({ color: 0xa3402d });
        const bedFrameMat = new THREE.MeshLambertMaterial({ color: 0x6f4e37 });
        const fabricMat = new THREE.MeshLambertMaterial({ color: 0xf1efe7 });
        const blanketMat = new THREE.MeshLambertMaterial({ color: 0x4f7f6a });
        const furnitureMat = new THREE.MeshLambertMaterial({ color: 0x8b6b4a });
        const shelfMat = new THREE.MeshLambertMaterial({ color: 0x75523b });
        const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7d41 });
        const potMat = new THREE.MeshLambertMaterial({ color: 0xa86442 });

        const createMesh = (geometry, material, positionVector, options = {}) => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(positionVector.x, positionVector.y, positionVector.z);
            mesh.castShadow = options.castShadow !== false;
            mesh.receiveShadow = options.receiveShadow !== false;
            if (options.rotationY) mesh.rotation.y = options.rotationY;
            if (options.rotationX) mesh.rotation.x = options.rotationX;
            if (options.rotationZ) mesh.rotation.z = options.rotationZ;
            houseGroup.add(mesh);
            return mesh;
        };

        createMesh(
            new THREE.BoxGeometry(width, wallHeight, wallThickness),
            wallMat,
            { x: 0, y: wallHeight / 2, z: backWallZ }
        );
        createMesh(
            new THREE.BoxGeometry(wallThickness, wallHeight, depth),
            wallMat,
            { x: -sideWallX, y: wallHeight / 2, z: sideWallZ }
        );
        createMesh(
            new THREE.BoxGeometry(wallThickness, wallHeight, depth),
            wallMat,
            { x: sideWallX, y: wallHeight / 2, z: sideWallZ }
        );
        createMesh(
            new THREE.BoxGeometry(frontWallSegmentWidth, wallHeight, wallThickness),
            wallMat,
            { x: -((doorWidth / 2) + (frontWallSegmentWidth / 2)), y: wallHeight / 2, z: frontWallZ }
        );
        createMesh(
            new THREE.BoxGeometry(frontWallSegmentWidth, wallHeight, wallThickness),
            wallMat,
            { x: (doorWidth / 2) + (frontWallSegmentWidth / 2), y: wallHeight / 2, z: frontWallZ }
        );
        createMesh(
            new THREE.BoxGeometry(doorWidth, wallHeight - doorHeight, wallThickness),
            wallMat,
            { x: 0, y: doorHeight + ((wallHeight - doorHeight) / 2), z: frontWallZ }
        );
        createMesh(
            new THREE.BoxGeometry(width - (wallThickness * 2), 0.14, depth - (wallThickness * 2)),
            floorMat,
            { x: 0, y: 0.07, z: 0 }
        );
        createMesh(
            new THREE.BoxGeometry(2.6, 0.03, 1.7),
            rugMat,
            { x: 0.6, y: 0.09, z: -0.25 },
            { castShadow: false }
        );

        const roof = createMesh(
            new THREE.ConeGeometry(roofRadius, roofHeight, 4),
            roofMat,
            { x: 0, y: wallHeight + (roofHeight / 2) - 0.05, z: 0 },
            { receiveShadow: false }
        );
        roof.rotation.y = Math.PI / 4;

        const frameThickness = 0.14;
        createMesh(
            new THREE.BoxGeometry(frameThickness, doorHeight, 0.16),
            trimMat,
            { x: -(doorWidth / 2) - (frameThickness / 2), y: doorHeight / 2, z: frontWallZ }
        );
        createMesh(
            new THREE.BoxGeometry(frameThickness, doorHeight, 0.16),
            trimMat,
            { x: (doorWidth / 2) + (frameThickness / 2), y: doorHeight / 2, z: frontWallZ }
        );
        createMesh(
            new THREE.BoxGeometry(doorWidth + (frameThickness * 2), frameThickness, 0.16),
            trimMat,
            { x: 0, y: doorHeight + (frameThickness / 2), z: frontWallZ }
        );

        const doorPivot = new THREE.Group();
        doorPivot.position.set(-(doorWidth / 2) + 0.06, 0, frontWallZ - 0.03);
        doorPivot.rotation.y = -1.2;
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(doorWidth - 0.16, doorHeight, 0.09),
            doorMat
        );
        door.position.set((doorWidth - 0.16) / 2, doorHeight / 2, 0);
        door.castShadow = true;
        door.receiveShadow = true;
        doorPivot.add(door);
        houseGroup.add(doorPivot);

        const createWindow = (x, y, z, rotationY = 0) => {
            const window = createMesh(
                new THREE.BoxGeometry(0.9, 0.9, 0.08),
                windowMat,
                { x, y, z },
                { rotationY }
            );

            const frameHorizontal = createMesh(
                new THREE.BoxGeometry(0.98, 0.06, 0.12),
                trimMat,
                { x, y, z },
                { rotationY }
            );
            const frameVertical = createMesh(
                new THREE.BoxGeometry(0.06, 0.98, 0.12),
                trimMat,
                { x, y, z },
                { rotationY }
            );

            window.castShadow = false;
            frameHorizontal.castShadow = false;
            frameVertical.castShadow = false;
        };

        createWindow(-frontWindowOffsetX, 3.15, frontWallZ + 0.03);
        createWindow(frontWindowOffsetX, 3.15, frontWallZ + 0.03);
        createWindow(-sideWallX + 0.03, 3.05, -sideWindowOffsetZ, Math.PI / 2);
        createWindow(sideWallX - 0.03, 3.05, sideWindowOffsetZ, Math.PI / 2);

        const chimney = createMesh(
            new THREE.BoxGeometry(0.8, 2, 0.8),
            new THREE.MeshLambertMaterial({ color: 0x8b6555 }),
            { x: 2.7, y: wallHeight + 1.45, z: 1.35 }
        );
        chimney.castShadow = true;

        createMesh(
            new THREE.BoxGeometry(1.8, 0.35, 2.25),
            bedFrameMat,
            { x: -2.3, y: 0.22, z: 1.15 }
        );
        createMesh(
            new THREE.BoxGeometry(1.58, 0.22, 2.0),
            fabricMat,
            { x: -2.3, y: 0.48, z: 1.15 }
        );
        createMesh(
            new THREE.BoxGeometry(1.52, 0.16, 1.2),
            blanketMat,
            { x: -2.3, y: 0.62, z: 1.4 }
        );
        createMesh(
            new THREE.BoxGeometry(1.8, 0.75, 0.12),
            bedFrameMat,
            { x: -2.3, y: 0.55, z: 2.2 }
        );
        createMesh(
            new THREE.BoxGeometry(0.62, 0.12, 0.38),
            new THREE.MeshLambertMaterial({ color: 0xf8f7f2 }),
            { x: -2.3, y: 0.65, z: 1.95 }
        );

        createMesh(
            new THREE.BoxGeometry(1.25, 0.12, 0.82),
            furnitureMat,
            { x: 1.85, y: 1.02, z: -0.8 }
        );
        [
            { x: 1.38, z: -1.12 },
            { x: 2.32, z: -1.12 },
            { x: 1.38, z: -0.48 },
            { x: 2.32, z: -0.48 },
        ].forEach((legPos) => {
            createMesh(
                new THREE.BoxGeometry(0.09, 0.82, 0.09),
                furnitureMat,
                { x: legPos.x, y: 0.55, z: legPos.z }
            );
        });
        createMesh(
            new THREE.BoxGeometry(0.62, 0.12, 0.62),
            furnitureMat,
            { x: 3.0, y: 0.58, z: -1.7 }
        );
        [
            { x: 2.77, z: -1.93 },
            { x: 3.23, z: -1.93 },
            { x: 2.77, z: -1.47 },
            { x: 3.23, z: -1.47 },
        ].forEach((legPos) => {
            createMesh(
                new THREE.BoxGeometry(0.07, 0.44, 0.07),
                furnitureMat,
                { x: legPos.x, y: 0.28, z: legPos.z }
            );
        });
        createMesh(
            new THREE.BoxGeometry(0.62, 0.5, 0.08),
            furnitureMat,
            { x: 3.0, y: 0.84, z: -1.98 }
        );
        createMesh(
            new THREE.BoxGeometry(1.05, 1.55, 0.45),
            shelfMat,
            { x: 3.05, y: 0.78, z: 1.8 }
        );
        createMesh(
            new THREE.BoxGeometry(0.95, 0.06, 0.42),
            trimMat,
            { x: 3.05, y: 1.08, z: 1.8 }
        );
        createMesh(
            new THREE.BoxGeometry(0.95, 0.06, 0.42),
            trimMat,
            { x: 3.05, y: 1.42, z: 1.8 }
        );
        createMesh(
            new THREE.CylinderGeometry(0.16, 0.22, 0.42, 10),
            potMat,
            { x: 3.05, y: 1.82, z: 1.83 }
        );
        createMesh(
            new THREE.SphereGeometry(0.34, 10, 10),
            leafMat,
            { x: 3.05, y: 2.22, z: 1.83 }
        );
        createMesh(
            new THREE.BoxGeometry(1.1, 0.7, 0.08),
            new THREE.MeshLambertMaterial({ color: 0xf5df90 }),
            { x: 0, y: 2.35, z: backWallZ - 0.05 }
        );
        createMesh(
            new THREE.BoxGeometry(1.24, 0.84, 0.06),
            trimMat,
            { x: 0, y: 2.35, z: backWallZ - 0.09 }
        );
        createMesh(
            new THREE.BoxGeometry(1.6, 0.18, 0.75),
            trimMat,
            { x: 0, y: 0.16, z: -halfDepth - 0.45 }
        );

        houseGroup.position.set(position.x, position.y, position.z);
        this.scene.add(houseGroup);
    }

    _createLake() {
        const lakeGeo = new THREE.CircleGeometry(this.lakeRadius, 32);
        const lakeMat = new THREE.MeshPhongMaterial({
            color: 0x2288cc,
            transparent: true,
            opacity: 0.7,
            shininess: 100,
            specular: 0x88ccff,
        });
        this.lake = new THREE.Mesh(lakeGeo, lakeMat);
        this.lake.rotation.x = -Math.PI / 2;
        this.lake.position.set(0, 0.05, 0);
        this.lake.receiveShadow = true;
        this.scene.add(this.lake);

        const edgeGeo = new THREE.RingGeometry(this.lakeRadius, this.lakeRadius + 0.8, 32);
        const edgeMat = new THREE.MeshLambertMaterial({ color: 0x3a7a3a });
        const edge = new THREE.Mesh(edgeGeo, edgeMat);
        edge.rotation.x = -Math.PI / 2;
        edge.position.set(0, 0.03, 0);
        this.scene.add(edge);

        const rockMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
            const r = this.lakeRadius + 0.5 + Math.random() * 0.5;
            const rockGeo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.3, 0);
            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.position.set(
                Math.cos(angle) * r,
                0.1 + Math.random() * 0.15,
                Math.sin(angle) * r
            );
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            rock.castShadow = true;
            this.scene.add(rock);
        }
    }

    _createTrees() {
        TREE_POSITIONS.forEach((pos, index) => {
            this._createTree(pos.x, pos.z, index);
        });
    }

    _createTree(x, z, index) {
        const treeGroup = new THREE.Group();

        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 3, 8);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2d8a4e });

        const c1 = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), canopyMat);
        c1.position.set(0, 4, 0);
        c1.castShadow = true;
        treeGroup.add(c1);

        const c2 = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), canopyMat);
        c2.position.set(0.8, 4.8, 0.5);
        c2.castShadow = true;
        treeGroup.add(c2);

        const c3 = new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 6), canopyMat);
        c3.position.set(-0.6, 4.5, -0.4);
        c3.castShadow = true;
        treeGroup.add(c3);

        const treeApples = [];
        const appleMat = new THREE.MeshPhongMaterial({
            color: 0xff4f4f,
            shininess: 90,
            specular: 0xffffff,
        });
        const stemMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
        const leafMat = new THREE.MeshLambertMaterial({ color: 0x4da85f });
        for (let i = 0; i < this.appleOffsets.length; i++) {
            const appleGroup = new THREE.Group();
            const apple = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), appleMat);
            apple.castShadow = true;
            apple.receiveShadow = true;
            appleGroup.add(apple);

            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.16, 6), stemMat);
            stem.position.y = 0.2;
            stem.castShadow = true;
            appleGroup.add(stem);

            const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), leafMat);
            leaf.scale.set(1.4, 0.45, 0.9);
            leaf.position.set(0.1, 0.22, 0.03);
            leaf.rotation.z = -0.65;
            appleGroup.add(leaf);

            const offset = this.appleOffsets[i];
            appleGroup.position.set(offset.x, offset.y, offset.z);
            treeGroup.add(appleGroup);

            const appleData = {
                mesh: appleGroup,
                treeGroup: treeGroup,
                treeIndex: index,
                slotIndex: i,
                collected: false,
            };

            treeApples.push(appleData);
            this.apples.push(appleData);
        }

        treeGroup.position.set(x, 0, z);
        treeGroup.userData.isTree = true;
        treeGroup.userData.treeIndex = index;
        treeGroup.userData.treeId = `tree-${index}`;
        this.trees.push(treeGroup);
        this.applesByTree.set(index, treeApples);
        this.scene.add(treeGroup);
    }

    _createDecorations() {
        const grandstandFootprint = buildSoccerGrandstandFootprint(DEFAULT_SOCCER_FIELD_LAYOUT, 1.2);
        const flowerColors = [0xff69b4, 0xffd700, 0xff6347, 0xda70d6, 0xffa500];
        for (let i = 0; i < 60; i++) {
            const x = (Math.random() - 0.5) * 80;
            const z = (Math.random() - 0.5) * 80;

            const distToLake = Math.sqrt(x * x + z * z);
            const distToHouse = Math.sqrt(x * x + (z - 20) * (z - 20));
            const isInsideSoccerField =
                Math.abs(x - DEFAULT_SOCCER_FIELD_LAYOUT.position.x) < (DEFAULT_SOCCER_FIELD_LAYOUT.width / 2) + 1.5
                && Math.abs(z - DEFAULT_SOCCER_FIELD_LAYOUT.position.z) < (DEFAULT_SOCCER_FIELD_LAYOUT.depth / 2) + 1.5;
            const isInsideGrandstand = isPointInsideRect({ x, z }, grandstandFootprint);
            if (distToLake < this.lakeRadius + 2 || distToHouse < 7 || isInsideSoccerField || isInsideGrandstand) continue;

            const flowerGeo = new THREE.SphereGeometry(0.12, 6, 6);
            const flowerMat = new THREE.MeshLambertMaterial({
                color: flowerColors[Math.floor(Math.random() * flowerColors.length)]
            });
            const flower = new THREE.Mesh(flowerGeo, flowerMat);
            flower.position.set(x, 0.15, z);
            this.scene.add(flower);

            const stemGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2);
            const stemMat = new THREE.MeshLambertMaterial({ color: 0x2d6b2d });
            const stem = new THREE.Mesh(stemGeo, stemMat);
            stem.position.set(x, 0.08, z);
            this.scene.add(stem);
        }

        const fenceMat = new THREE.MeshLambertMaterial({ color: 0xc4a56e });
        const fencePositions = [
            { x: -6.5, z: 15, ry: 0 },
            { x: 6.5, z: 15, ry: 0 },
            { x: -6.5, z: 25, ry: 0 },
            { x: 6.5, z: 25, ry: 0 },
        ];
        fencePositions.forEach((fp) => {
            for (let i = 0; i < 5; i++) {
                const post = new THREE.Mesh(
                    new THREE.BoxGeometry(0.1, 1.2, 0.1),
                    fenceMat
                );
                post.position.set(fp.x + (i - 2) * 0.8, 0.6, fp.z);
                post.castShadow = true;
                this.scene.add(post);
            }
            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(4, 0.08, 0.08),
                fenceMat
            );
            rail.position.set(fp.x, 0.9, fp.z);
            this.scene.add(rail);
            const rail2 = new THREE.Mesh(
                new THREE.BoxGeometry(4, 0.08, 0.08),
                fenceMat
            );
            rail2.position.set(fp.x, 0.4, fp.z);
            this.scene.add(rail2);
        });
    }

    update(time) {
        if (this.lake) {
            this.lake.material.opacity = 0.65 + Math.sin(time * 1.5) * 0.05;
        }

        if (this.soccerBall && this.soccerBallInitialized) {
            if (this.soccerBallPossessed && this.soccerBallCarrierState) {
                const carrierTarget = this._clampSoccerBallTargetInsideField(
                    this._getSoccerBallCarrierTarget(this.soccerBallCarrierState)
                );
                this.soccerBallTargetPosition.set(carrierTarget.x, carrierTarget.y, carrierTarget.z);
            }

            const previousPosition = this.soccerBall.position.clone();
            const targetDistance = previousPosition.distanceTo(this.soccerBallTargetPosition);
            if (this.soccerBallPossessed) {
                if (targetDistance > 0.75) {
                    this.soccerBall.position.copy(this.soccerBallTargetPosition);
                } else {
                    this.soccerBall.position.lerp(this.soccerBallTargetPosition, 0.82);
                }
            } else if (targetDistance > 2.6) {
                this.soccerBall.position.copy(this.soccerBallTargetPosition);
            } else {
                const followStrength = targetDistance > 1.2 ? 0.46 : 0.18;
                this.soccerBall.position.lerp(this.soccerBallTargetPosition, followStrength);
            }
            const movement = this.soccerBall.position.clone().sub(previousPosition);
            const movementLength = movement.length();
            if (movementLength > 0.0005) {
                this.soccerBall.rotation.z += movement.x * 1.9;
                this.soccerBall.rotation.x -= movement.z * 1.9;
            }
        }

        if (this.soccerGoalBanner) {
            const remainingMs = this.soccerGoalBannerVisibleUntil - performance.now();
            if (remainingMs > 0) {
                const pulse = 1 + (Math.sin(time * 7.5) * 0.035);
                const baseScale = this.soccerGoalBanner.userData.baseScale || { x: 12.6, y: 6.3 };
                this.soccerGoalBanner.visible = true;
                this.soccerGoalBanner.scale.set(baseScale.x * pulse, baseScale.y * pulse, 1);
                this.soccerGoalBanner.material.opacity = remainingMs < 420 ? remainingMs / 420 : 1;
            } else if (this.soccerGoalBanner.visible) {
                this.soccerGoalBanner.visible = false;
                this.soccerGoalBanner.material.opacity = 0;
            }
        }

        this.scene.traverse((obj) => {
            if (obj.userData.isCloud) {
                obj.position.x += obj.userData.speed * 0.016;
                if (obj.position.x > 50) obj.position.x = -50;
            }
        });

        this.apples.forEach((appleData, index) => {
            if (!appleData.collected) {
                const offset = this.appleOffsets[appleData.slotIndex];
                appleData.mesh.position.y = offset.y + Math.sin(time * 2 + index) * 0.08;
                const pulseScale = 1 + (Math.sin((time * 3.2) + index) * 0.06);
                appleData.mesh.scale.setScalar(pulseScale);
            }
        });

        Array.from(this.looseApples.values()).forEach((marker, index) => {
            const baseY = Number(marker.userData.baseY) || 0.22;
            const floatSeed = Number(marker.userData.floatSeed) || 0;
            marker.position.y = baseY + (Math.sin((time * 2.6) + floatSeed + index) * 0.045);
            const pulseScale = 1 + (Math.sin((time * 3.4) + floatSeed + index) * 0.04);
            marker.scale.setScalar(pulseScale);
        });
    }

    setWorldBounds(bounds) {
        if (Number.isFinite(bounds) && bounds > 0) {
            this.bounds = bounds;
        }
    }

    _getActorGroundHeight(position) {
        for (let index = this.soccerGrandstandStepSurfaces.length - 1; index >= 0; index -= 1) {
            const surface = this.soccerGrandstandStepSurfaces[index];
            if (isPointInsideRect(position, surface, 0)) {
                return Number(surface.height) || 0;
            }
        }

        return 0;
    }

    isBlockedPosition(position, padding = PLAYER_COLLISION_RADIUS) {
        const collisionBoxes = [...this.houseWallCollisionBoxes, ...this.soccerGrandstandCollisionBoxes];
        return collisionBoxes.some((rect) => isPointInsideRect(position, rect, padding));
    }

    resolveActorMovement(currentPosition, nextPosition, padding = PLAYER_COLLISION_RADIUS) {
        const current = clonePoint(currentPosition);
        const candidate = {
            x: clamp(Number(nextPosition?.x) || 0, -this.bounds, this.bounds),
            y: Number(nextPosition?.y) || current.y,
            z: clamp(Number(nextPosition?.z) || 0, -this.bounds, this.bounds),
        };
        const resolved = {
            x: current.x,
            y: 0,
            z: current.z,
        };

        if (!this.isBlockedPosition({ x: candidate.x, y: candidate.y, z: current.z }, padding)) {
            resolved.x = candidate.x;
        }

        if (!this.isBlockedPosition({ x: resolved.x, y: candidate.y, z: candidate.z }, padding)) {
            resolved.z = candidate.z;
        }

        resolved.y = this._getActorGroundHeight(resolved);
        return resolved;
    }

    getTreePosition(index) {
        if (this.trees[index]) {
            return this.trees[index].position;
        }
        return null;
    }

    _createGraveMarker(graveState) {
        const marker = new THREE.Group();
        const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b6b4a });
        const stoneMat = new THREE.MeshLambertMaterial({ color: 0x9aa3af });
        const flowerMat = new THREE.MeshLambertMaterial({ color: 0xe11d48 });
        const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f855a });

        const mound = new THREE.Mesh(
            new THREE.CylinderGeometry(0.72, 0.96, 0.18, 18),
            stoneMat
        );
        mound.position.y = 0.09;
        mound.receiveShadow = true;
        marker.add(mound);

        const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 1.55, 0.16),
            woodMat
        );
        post.position.y = 0.9;
        post.castShadow = true;
        post.receiveShadow = true;
        marker.add(post);

        const arm = new THREE.Mesh(
            new THREE.BoxGeometry(0.72, 0.14, 0.14),
            woodMat
        );
        arm.position.set(0, 1.15, 0);
        arm.castShadow = true;
        arm.receiveShadow = true;
        marker.add(arm);

        const flower = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 10, 10),
            flowerMat
        );
        flower.position.set(0.2, 0.24, 0.12);
        marker.add(flower);

        const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 8),
            leafMat
        );
        leaf.scale.set(1.2, 0.45, 0.8);
        leaf.position.set(0.28, 0.28, 0.12);
        leaf.rotation.z = -0.55;
        marker.add(leaf);

        const nameplate = this._createGraveNameplate(graveState);
        marker.add(nameplate);
        marker.userData.nameplate = nameplate;
        marker.userData.actorName = String(graveState?.actorName || 'Finado').trim() || 'Finado';

        marker.position.set(
            Number(graveState?.position?.x) || 0,
            Number(graveState?.position?.y) || 0,
            Number(graveState?.position?.z) || 0
        );
        marker.rotation.y = ((Number(graveState?.position?.x) || 0) * 0.11) % (Math.PI * 2);
        this.scene.add(marker);
        return marker;
    }

    removeApple(appleData) {
        appleData.collected = true;
        appleData.mesh.visible = false;
    }

    _createLooseAppleMarker(appleState) {
        const appleGroup = new THREE.Group();
        const appleMat = new THREE.MeshPhongMaterial({
            color: 0xff4f4f,
            shininess: 90,
            specular: 0xffffff,
        });
        const stemMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
        const leafMat = new THREE.MeshLambertMaterial({ color: 0x4da85f });

        const apple = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), appleMat);
        apple.castShadow = true;
        apple.receiveShadow = true;
        appleGroup.add(apple);

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.16, 6), stemMat);
        stem.position.y = 0.2;
        stem.castShadow = true;
        appleGroup.add(stem);

        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), leafMat);
        leaf.scale.set(1.4, 0.45, 0.9);
        leaf.position.set(0.1, 0.22, 0.03);
        leaf.rotation.z = -0.65;
        appleGroup.add(leaf);

        appleGroup.position.set(
            Number(appleState?.position?.x) || 0,
            Number(appleState?.position?.y) || 0.22,
            Number(appleState?.position?.z) || 0
        );
        appleGroup.rotation.y = Math.random() * Math.PI * 2;
        appleGroup.userData.baseY = appleGroup.position.y;
        appleGroup.userData.floatSeed = Math.random() * Math.PI * 2;
        this.scene.add(appleGroup);
        return appleGroup;
    }

    _disposeLooseAppleMarker(marker) {
        if (!marker) {
            return;
        }

        marker.traverse((child) => {
            if (child.material) {
                child.material.dispose();
            }

            if (child.geometry) {
                child.geometry.dispose();
            }
        });
    }

    syncDroppedApples(appleStates) {
        const activeIds = new Set();
        const nextAppleStates = Array.isArray(appleStates) ? appleStates : [];

        nextAppleStates.forEach((appleState) => {
            if (!appleState?.id) {
                return;
            }

            activeIds.add(appleState.id);

            if (!this.looseApples.has(appleState.id)) {
                this.looseApples.set(appleState.id, this._createLooseAppleMarker(appleState));
                return;
            }

            const marker = this.looseApples.get(appleState.id);
            marker.position.set(
                Number(appleState?.position?.x) || 0,
                Number(appleState?.position?.y) || 0.22,
                Number(appleState?.position?.z) || 0
            );
            marker.userData.baseY = marker.position.y;
        });

        Array.from(this.looseApples.entries()).forEach(([appleId, marker]) => {
            if (activeIds.has(appleId)) {
                return;
            }

            this.scene.remove(marker);
            this._disposeLooseAppleMarker(marker);
            this.looseApples.delete(appleId);
        });
    }

    syncTreeState(treeStates) {
        if (!Array.isArray(treeStates)) return;

        const remainingByTree = new Map(
            treeStates.map((treeState) => [
                treeState.id,
                Number.isFinite(treeState.applesRemaining) ? treeState.applesRemaining : 0,
            ])
        );

        this.trees.forEach((treeGroup, treeIndex) => {
            const treeId = treeGroup.userData.treeId;
            const applesRemaining = remainingByTree.get(treeId);
            if (!Number.isFinite(applesRemaining)) return;

            const treeApples = this.applesByTree.get(treeIndex) || [];
            treeApples.forEach((appleData, appleIndex) => {
                const isVisible = appleIndex < applesRemaining;
                appleData.collected = !isVisible;
                appleData.mesh.visible = isVisible;
                if (isVisible) {
                    appleData.mesh.scale.setScalar(1);
                }
            });
        });
    }

    syncGraves(graveStates) {
        if (!Array.isArray(graveStates)) return;

        const activeIds = new Set();

        graveStates.forEach((graveState) => {
            if (!graveState?.id) {
                return;
            }

            activeIds.add(graveState.id);

            if (!this.graves.has(graveState.id)) {
                this.graves.set(graveState.id, this._createGraveMarker(graveState));
                return;
            }

            const marker = this.graves.get(graveState.id);
            marker.position.set(
                Number(graveState?.position?.x) || 0,
                Number(graveState?.position?.y) || 0,
                Number(graveState?.position?.z) || 0
            );
            this._updateGraveNameplate(marker, graveState);
        });

        Array.from(this.graves.entries()).forEach(([graveId, marker]) => {
            if (activeIds.has(graveId)) {
                return;
            }

            this.scene.remove(marker);
            this._disposeGraveMarker(marker);
            this.graves.delete(graveId);
        });
    }

    getAvailableApplesNearPosition(pos, radius) {
        return this.apples.filter((appleData) => {
            if (appleData.collected) return false;
            const treePos = this.trees[appleData.treeIndex].position;
            const dist = pos.distanceTo(treePos);
            return dist < radius;
        });
    }
}
