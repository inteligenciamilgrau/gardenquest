const LAKE = Object.freeze({
  id: 'lake',
  type: 'lake',
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  radius: 6,
});

const HOUSE = Object.freeze({
  id: 'house',
  type: 'house',
  position: Object.freeze({ x: 0, y: 0, z: 20 }),
  width: 8.5,
  depth: 7,
  wallHeight: 5.2,
  wallThickness: 0.35,
  doorWidth: 2.4,
  doorHeight: 3.6,
});

const SOCCER_FIELD = Object.freeze({
  id: 'soccer-field',
  type: 'soccer_field',
  position: Object.freeze({ x: 0, y: 0, z: -31 }),
  width: 18,
  depth: 28,
  goalWidth: 6.8,
  goalDepth: 2.8,
  goalHeight: 2.5,
  postThickness: 0.18,
  lineWidth: 0.18,
  ballRadius: 0.42,
  grandstandSide: 'east',
  grandstandSidelineGap: 3.8,
  grandstandLengthPadding: 4.8,
  grandstandTiers: 4,
  grandstandTierHeight: 0.58,
  grandstandTierDepth: 1.25,
});

const TREE_POSITIONS = Object.freeze([
  Object.freeze({ x: -24, y: 0, z: -8 }),
  Object.freeze({ x: -16, y: 0, z: 8 }),
  Object.freeze({ x: 16, y: 0, z: 9 }),
  Object.freeze({ x: 26, y: 0, z: -6 }),
  Object.freeze({ x: -26, y: 0, z: 18 }),
  Object.freeze({ x: 20, y: 0, z: 20 }),
  Object.freeze({ x: -18, y: 0, z: 30 }),
  Object.freeze({ x: 28, y: 0, z: 8 }),
]);

const APPLE_OFFSETS = Object.freeze([
  Object.freeze({ x: 1.55, y: 3.85, z: 0.75 }),
  Object.freeze({ x: -1.35, y: 4.15, z: 0.95 }),
  Object.freeze({ x: 0.95, y: 4.55, z: -1.3 }),
  Object.freeze({ x: -0.35, y: 4.85, z: -0.95 }),
  Object.freeze({ x: 0.25, y: 3.75, z: 1.45 }),
  Object.freeze({ x: -1.55, y: 4.45, z: -0.15 }),
]);

const WORLD_BOUNDS = 45;
const PLAYER_COLLISION_RADIUS = 0.45;

function clonePoint(point) {
  return {
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
    z: Number(point?.z) || 0,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createRect(minX, maxX, minZ, maxZ) {
  return Object.freeze({
    minX,
    maxX,
    minZ,
    maxZ,
  });
}

function cloneRect(rect) {
  return {
    minX: Number(rect?.minX) || 0,
    maxX: Number(rect?.maxX) || 0,
    minZ: Number(rect?.minZ) || 0,
    maxZ: Number(rect?.maxZ) || 0,
  };
}

function cloneGrave(grave) {
  return {
    id: typeof grave?.id === 'string' ? grave.id : '',
    actorId: typeof grave?.actorId === 'string' ? grave.actorId : '',
    actorType: grave?.actorType === 'ai' ? 'ai' : 'player',
    actorName: typeof grave?.actorName === 'string' ? grave.actorName : '',
    position: clonePoint(grave?.position),
  };
}

function cloneDroppedApple(apple) {
  return {
    id: typeof apple?.id === 'string' ? apple.id : '',
    position: clonePoint(apple?.position),
  };
}

function cloneSoccerGoalEvent(goalEvent) {
  if (!goalEvent || typeof goalEvent !== 'object') {
    return null;
  }

  return {
    sequence: Number(goalEvent.sequence) || 0,
    side: goalEvent.side === 'north' ? 'north' : 'south',
    playerId: typeof goalEvent.playerId === 'string' ? goalEvent.playerId : '',
    playerName: typeof goalEvent.playerName === 'string' ? goalEvent.playerName : '',
    createdAt: Number(goalEvent.createdAt) || 0,
  };
}

function cloneSoccerState(soccer) {
  return {
    field: {
      id: SOCCER_FIELD.id,
      type: SOCCER_FIELD.type,
      position: clonePoint(soccer?.field?.position || SOCCER_FIELD.position),
      width: SOCCER_FIELD.width,
      depth: SOCCER_FIELD.depth,
      goalWidth: SOCCER_FIELD.goalWidth,
      goalDepth: SOCCER_FIELD.goalDepth,
      goalHeight: SOCCER_FIELD.goalHeight,
      postThickness: SOCCER_FIELD.postThickness,
      lineWidth: SOCCER_FIELD.lineWidth,
      ballRadius: SOCCER_FIELD.ballRadius,
      grandstandSide: soccer?.field?.grandstandSide === 'west' ? 'west' : SOCCER_FIELD.grandstandSide,
      grandstandSidelineGap: Number(soccer?.field?.grandstandSidelineGap) || SOCCER_FIELD.grandstandSidelineGap,
      grandstandLengthPadding: Number(soccer?.field?.grandstandLengthPadding) || SOCCER_FIELD.grandstandLengthPadding,
      grandstandTiers: Math.max(1, Math.trunc(Number(soccer?.field?.grandstandTiers) || SOCCER_FIELD.grandstandTiers)),
      grandstandTierHeight: Number(soccer?.field?.grandstandTierHeight) || SOCCER_FIELD.grandstandTierHeight,
      grandstandTierDepth: Number(soccer?.field?.grandstandTierDepth) || SOCCER_FIELD.grandstandTierDepth,
    },
    ball: {
      position: clonePoint(soccer?.ball?.position),
      velocity: clonePoint(soccer?.ball?.velocity),
      radius: Number(soccer?.ball?.radius) || SOCCER_FIELD.ballRadius,
      inGoal: soccer?.ball?.inGoal === 'north' || soccer?.ball?.inGoal === 'south'
        ? soccer.ball.inGoal
        : null,
      lastTouchedByActorId: typeof soccer?.ball?.lastTouchedByActorId === 'string'
        ? soccer.ball.lastTouchedByActorId
        : '',
      lastTouchedByActorName: typeof soccer?.ball?.lastTouchedByActorName === 'string'
        ? soccer.ball.lastTouchedByActorName
        : '',
      possessedByActorId: typeof soccer?.ball?.possessedByActorId === 'string'
        ? soccer.ball.possessedByActorId
        : '',
      possessedByActorName: typeof soccer?.ball?.possessedByActorName === 'string'
        ? soccer.ball.possessedByActorName
        : '',
    },
    restartAt: Number(soccer?.restartAt) || 0,
    lastGoalEvent: cloneSoccerGoalEvent(soccer?.lastGoalEvent),
  };
}

function createHouseWallCollisionBoxes(layout) {
  const halfWidth = layout.width / 2;
  const halfDepth = layout.depth / 2;
  const halfDoorWidth = layout.doorWidth / 2;
  const wallThickness = layout.wallThickness;
  const southEdge = layout.position.z - halfDepth;
  const northEdge = layout.position.z + halfDepth;
  const westEdge = layout.position.x - halfWidth;
  const eastEdge = layout.position.x + halfWidth;

  return [
    createRect(
      westEdge,
      eastEdge,
      northEdge - wallThickness,
      northEdge
    ),
    createRect(
      westEdge,
      westEdge + wallThickness,
      southEdge,
      northEdge
    ),
    createRect(
      eastEdge - wallThickness,
      eastEdge,
      southEdge,
      northEdge
    ),
    createRect(
      westEdge,
      layout.position.x - halfDoorWidth,
      southEdge,
      southEdge + wallThickness
    ),
    createRect(
      layout.position.x + halfDoorWidth,
      eastEdge,
      southEdge,
      southEdge + wallThickness
    ),
  ];
}

const HOUSE_WALL_COLLISION_BOXES = Object.freeze(createHouseWallCollisionBoxes(HOUSE));

function getSoccerGrandstandLayout(fieldState = SOCCER_FIELD) {
  const centerX = Number(fieldState?.position?.x) || 0;
  const centerZ = Number(fieldState?.position?.z) || 0;
  const fieldWidth = Number(fieldState?.width) || SOCCER_FIELD.width;
  const fieldDepth = Number(fieldState?.depth) || SOCCER_FIELD.depth;
  const side = fieldState?.grandstandSide === 'west' ? 'west' : SOCCER_FIELD.grandstandSide;
  const sideMultiplier = side === 'west' ? -1 : 1;
  const sidelineGap = Number(fieldState?.grandstandSidelineGap) || SOCCER_FIELD.grandstandSidelineGap;
  const lengthPadding = Number(fieldState?.grandstandLengthPadding) || SOCCER_FIELD.grandstandLengthPadding;
  const tiers = Math.max(1, Math.trunc(Number(fieldState?.grandstandTiers) || SOCCER_FIELD.grandstandTiers));
  const tierHeight = Number(fieldState?.grandstandTierHeight) || SOCCER_FIELD.grandstandTierHeight;
  const tierDepth = Number(fieldState?.grandstandTierDepth) || SOCCER_FIELD.grandstandTierDepth;
  const depth = (tiers * tierDepth) + 0.6;
  const length = fieldDepth + lengthPadding;
  const frontX = centerX + sideMultiplier * ((fieldWidth / 2) + sidelineGap);
  const backX = frontX + sideMultiplier * depth;

  return {
    centerX: frontX + (sideMultiplier * (depth / 2)),
    centerZ,
    depth,
    length,
    frontX,
    backX,
    minX: Math.min(frontX, backX),
    maxX: Math.max(frontX, backX),
    minZ: centerZ - (length / 2),
    maxZ: centerZ + (length / 2),
    side,
    sideMultiplier,
    sidelineGap,
    tiers,
    tierHeight,
    tierDepth,
  };
}

function createSoccerGrandstandCollisionBoxes(fieldState = SOCCER_FIELD) {
  const layout = getSoccerGrandstandLayout(fieldState);
  const backWallThickness = 0.3;
  const endWallThickness = 0.22;

  return [
    createRect(
      Math.min(layout.backX, layout.backX + (layout.sideMultiplier * backWallThickness)),
      Math.max(layout.backX, layout.backX + (layout.sideMultiplier * backWallThickness)),
      layout.minZ - 0.08,
      layout.maxZ + 0.08
    ),
    createRect(
      layout.minX - 0.08,
      layout.maxX + 0.08,
      layout.minZ - endWallThickness,
      layout.minZ
    ),
    createRect(
      layout.minX - 0.08,
      layout.maxX + 0.08,
      layout.maxZ,
      layout.maxZ + endWallThickness
    ),
  ];
}

function getSoccerGrandstandSurfaceHeight(fieldState = SOCCER_FIELD, position) {
  const layout = getSoccerGrandstandLayout(fieldState);

  for (let tierIndex = layout.tiers - 1; tierIndex >= 0; tierIndex -= 1) {
    const tierStartX = layout.frontX + (layout.sideMultiplier * (tierIndex * layout.tierDepth));
    const tierEndX = layout.frontX + (layout.sideMultiplier * ((tierIndex + 1) * layout.tierDepth));
    const tierRect = createRect(
      Math.min(tierStartX, tierEndX),
      Math.max(tierStartX, tierEndX),
      layout.minZ + 0.18,
      layout.maxZ - 0.18
    );

    if (isPositionInsideRect(position, tierRect, 0)) {
      return (tierIndex + 1) * layout.tierHeight;
    }
  }

  return 0;
}

function getWorldCollisionBoxes(worldState) {
  const houseCollisionBoxes = worldState?.house?.walls || HOUSE_WALL_COLLISION_BOXES;
  const grandstandCollisionBoxes = createSoccerGrandstandCollisionBoxes(worldState?.soccer?.field || SOCCER_FIELD);
  return [...houseCollisionBoxes, ...grandstandCollisionBoxes];
}

function getWorldSurfaceHeight(worldState, position) {
  return Math.max(
    0,
    getSoccerGrandstandSurfaceHeight(worldState?.soccer?.field || SOCCER_FIELD, position)
  );
}

function isPositionInsideRect(position, rect, padding = 0) {
  return (
    position.x >= rect.minX - padding &&
    position.x <= rect.maxX + padding &&
    position.z >= rect.minZ - padding &&
    position.z <= rect.maxZ + padding
  );
}

function isPositionBlocked(worldState, position, padding = 0) {
  const collisionBoxes = getWorldCollisionBoxes(worldState);
  return collisionBoxes.some((rect) => isPositionInsideRect(position, rect, padding));
}

function resolveWalkablePosition(worldState, currentPosition, nextPosition, padding = 0) {
  const bounds = Number.isFinite(worldState?.bounds) ? worldState.bounds : WORLD_BOUNDS;
  const current = clonePoint(currentPosition);
  const candidate = {
    x: clamp(Number(nextPosition?.x) || 0, -bounds, bounds),
    y: Number(nextPosition?.y) || current.y,
    z: clamp(Number(nextPosition?.z) || 0, -bounds, bounds),
  };
  const resolved = {
    x: current.x,
    y: candidate.y,
    z: current.z,
  };

  if (!isPositionBlocked(worldState, { x: candidate.x, y: candidate.y, z: current.z }, padding)) {
    resolved.x = candidate.x;
  }

  if (!isPositionBlocked(worldState, { x: resolved.x, y: candidate.y, z: candidate.z }, padding)) {
    resolved.z = candidate.z;
  }

  resolved.y = getWorldSurfaceHeight(worldState, resolved);
  return resolved;
}

function createWorldState() {
  return {
    bounds: WORLD_BOUNDS,
    lake: {
      ...LAKE,
      position: clonePoint(LAKE.position),
    },
    house: {
      ...HOUSE,
      position: clonePoint(HOUSE.position),
      walls: HOUSE_WALL_COLLISION_BOXES.map(cloneRect),
    },
    trees: TREE_POSITIONS.map((position, index) => ({
      id: `tree-${index}`,
      type: 'tree',
      position: clonePoint(position),
      applesRemaining: APPLE_OFFSETS.length,
      maxApples: APPLE_OFFSETS.length,
      nextAppleRegrowAt: null,
    })),
    droppedApples: [],
    soccer: cloneSoccerState({
      field: SOCCER_FIELD,
      ball: {
        position: {
          x: SOCCER_FIELD.position.x,
          y: SOCCER_FIELD.ballRadius,
          z: SOCCER_FIELD.position.z,
        },
        velocity: { x: 0, y: 0, z: 0 },
        radius: SOCCER_FIELD.ballRadius,
        inGoal: null,
        lastTouchedByActorId: '',
        lastTouchedByActorName: '',
        possessedByActorId: '',
        possessedByActorName: '',
      },
      restartAt: 0,
      lastGoalEvent: null,
    }),
    graves: [],
  };
}

function getTargetById(worldState, targetId) {
  if (targetId === LAKE.id) {
    return {
      id: LAKE.id,
      type: LAKE.type,
      position: clonePoint(LAKE.position),
      radius: LAKE.radius,
    };
  }

  const tree = worldState.trees.find((candidate) => candidate.id === targetId);
  if (!tree) {
    return null;
  }

  return {
    id: tree.id,
    type: tree.type,
    position: clonePoint(tree.position),
    applesRemaining: tree.applesRemaining,
  };
}

function getPublicWorldState(worldState) {
  return {
    bounds: worldState.bounds,
    lake: {
      id: worldState.lake.id,
      type: worldState.lake.type,
      position: clonePoint(worldState.lake.position),
      radius: worldState.lake.radius,
    },
    house: {
      id: worldState.house.id,
      type: worldState.house.type,
      position: clonePoint(worldState.house.position),
      width: worldState.house.width,
      depth: worldState.house.depth,
      wallHeight: worldState.house.wallHeight,
      wallThickness: worldState.house.wallThickness,
      doorWidth: worldState.house.doorWidth,
      doorHeight: worldState.house.doorHeight,
      collisionBoxes: worldState.house.walls.map(cloneRect),
    },
    trees: worldState.trees.map((tree) => ({
      id: tree.id,
      type: tree.type,
      position: clonePoint(tree.position),
      applesRemaining: tree.applesRemaining,
    })),
    droppedApples: Array.isArray(worldState.droppedApples)
      ? worldState.droppedApples.map(cloneDroppedApple)
      : [],
    soccer: cloneSoccerState(worldState.soccer),
    graves: Array.isArray(worldState.graves)
      ? worldState.graves.map(cloneGrave)
      : [],
    appleLayout: APPLE_OFFSETS.map(clonePoint),
  };
}

module.exports = {
  APPLE_OFFSETS,
  HOUSE,
  LAKE,
  PLAYER_COLLISION_RADIUS,
  SOCCER_FIELD,
  WORLD_BOUNDS,
  TREE_POSITIONS,
  createWorldState,
  getPublicWorldState,
  getTargetById,
  isPositionBlocked,
  resolveWalkablePosition,
};
