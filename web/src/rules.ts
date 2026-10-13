export type Battle = {
  id: bigint;
  startedAt: bigint;
  deadline: bigint;
  epoch: bigint;
  status: number;
  faction: number;
  difficulty: number;
  turn: number;
  tech: number;
  recruits: number;
  tanks: number;
  commandos: number;
  harvests: number;
  points: number;
  ore: number;
  baseHP: number;
  enemyHP: number;
  rewarded: boolean;
};
export const structures = [
  "Headquarters",
  "Power plant",
  "Barracks",
  "Factory",
  "Tech center",
];
export const buildCosts = [0, 30, 40, 60, 80];
export const unitNames = ["Recruit Pepe", "Tank Pepe", "Commando Pepe"];
export const cosmetics = [
  "Recruit pip",
  "Engineer patch",
  "Harvester glow",
  "Tank chevron",
  "Commando visor",
  "Initiative banner",
  "Cult banner",
  "Veteran insignia",
];
export const statusNames = [
  "Ready",
  "In battle",
  "Victory",
  "Base lost",
  "Expired",
  "Surrendered",
];
export function startBattle(
  faction: number,
  difficulty: number,
  now: number,
  id = 1n,
): Battle {
  return {
    id,
    startedAt: BigInt(now),
    deadline: BigInt(now + 1200),
    epoch: BigInt(Math.floor(now / 86400)),
    status: 1,
    faction,
    difficulty,
    turn: 0,
    tech: 0,
    recruits: 0,
    tanks: 0,
    commandos: 0,
    harvests: 0,
    points: 0,
    ore: 100,
    baseHP: faction === 0 ? 200 : 160,
    enemyHP: 120 + 60 * difficulty,
    rewarded: false,
  };
}
export const strength = (b: Battle) =>
  b.recruits * 8 + b.tanks * 20 + b.commandos * 32;
export const armySize = (b: Battle) => b.recruits + b.tanks + b.commandos;
export const unitCost = (b: Battle, rank: number) =>
  [20, 45, 60][rank] + (b.faction === 0 ? 5 : 0);
export const nextMoveAt = (b: Battle) =>
  Number(b.startedAt) + (b.turn + 1) * 10;
export function moveReason(
  b: Battle,
  command: number,
  argument: number,
  now: number,
): string | null {
  if (b.status !== 1) return "Start a battle first.";
  if (now >= Number(b.deadline))
    return "Battle deadline reached. Close the expired battle.";
  if (command === 7) return null;
  if (now < nextMoveAt(b))
    return `Next order in ${Math.ceil(nextMoveAt(b) - now)}s.`;
  if (command === 2 && (argument > 4 || argument !== b.tech + 1))
    return "Build structures in order.";
  if (command === 2 && b.ore < buildCosts[argument])
    return `Need ${buildCosts[argument]} ore.`;
  if (command === 3) {
    if (b.tech < argument + 2)
      return `Requires ${structures[argument + 2].toLowerCase()}.`;
    if (armySize(b) >= 12) return "Army is full (12 Pepes).";
    if (b.ore < unitCost(b, argument))
      return `Need ${unitCost(b, argument)} ore.`;
  }
  if (command === 4 && strength(b) <= 3 * b.difficulty)
    return "Produce an army first.";
  if (command === 5 && strength(b) < 12 + b.difficulty * 8)
    return `Need ${12 + b.difficulty * 8} army strength.`;
  if (command === 6 && b.ore < 25) return "Need 25 ore to repair.";
  if (command === 6 && b.baseHP >= (b.faction === 0 ? 200 : 160))
    return "Base is at full health.";
  const wins =
    (command === 5 && b.points === 2) ||
    (command === 4 && strength(b) - b.difficulty * 3 >= b.enemyHP);
  if (wins && now < Number(b.startedAt) + 300)
    return `Victory unlocks in ${Math.ceil(Number(b.startedAt) + 300 - now)}s.`;
  return null;
}
export function stepBattle(
  current: Battle,
  command: number,
  argument: number,
  now: number,
): Battle {
  const reason = moveReason(current, command, argument, now);
  if (reason) throw Error(reason);
  const b = { ...current };
  if (command === 7) return { ...b, status: 5 };
  if (command !== 5) b.points = 0;
  switch (command) {
    case 1:
      b.ore += b.faction === 0 ? 30 : 35;
      b.harvests++;
      break;
    case 2:
      b.ore -= buildCosts[argument];
      b.tech = argument;
      break;
    case 3:
      b.ore -= unitCost(b, argument);
      if (argument === 0) b.recruits++;
      else if (argument === 1) b.tanks++;
      else b.commandos++;
      break;
    case 4:
      b.enemyHP = Math.max(0, b.enemyHP - strength(b) + 3 * b.difficulty);
      break;
    case 5:
      b.points++;
      break;
    case 6:
      b.ore -= 25;
      b.baseHP = Math.min(b.faction === 0 ? 200 : 160, b.baseHP + 30);
      break;
    default:
      throw Error("Unknown order.");
  }
  b.turn++;
  if (b.enemyHP === 0 || b.points === 3) return { ...b, status: 2 };
  const defense =
    (b.faction === 0 ? 3 : 1) + b.recruits + 2 * b.tanks + b.commandos;
  b.baseHP = Math.max(
    0,
    b.baseHP -
      Math.max(0, 5 + 2 * b.difficulty + Math.floor(b.turn / 6) - defense),
  );
  if (b.baseHP === 0 || b.turn === 48) b.status = 3;
  return b;
}
export function orderDescription(
  command: number,
  argument: number,
  b?: Battle,
) {
  switch (command) {
    case 0:
      return `Start ${argument % 2 === 0 ? "Initiative" : "Cult"} battle at difficulty ${Math.floor(argument / 2) + 1}. Free entry; network gas applies.`;
    case 1:
      return `Harvest ${b?.faction === 1 ? 35 : 30} ore. Enemy retaliation follows.`;
    case 2:
      return `Build ${structures[argument].toLowerCase()} for ${buildCosts[argument]} ore. Enemy retaliation follows.`;
    case 3:
      return `Produce ${unitNames[argument]} for ${b ? unitCost(b, argument) : "the required"} ore. Enemy retaliation follows.`;
    case 4:
      return "Attack the enemy base with your army. Enemy retaliation follows unless you win.";
    case 5:
      return "Hold the control point. Three consecutive holds win after five minutes.";
    case 6:
      return "Spend 25 ore to repair up to 30 base HP. Enemy retaliation follows.";
    case 7:
      return "Surrender this battle. This battle will earn zero rewards.";
    case 8:
      return `Buy ${cosmetics[argument]} for 100 PEPEFRONT. 75 are permanently retired; 25 fund tomorrow. No combat advantage.`;
    case 9:
      return "Claim all matured IMD to your connected wallet.";
    default:
      return "Confirm contract action.";
  }
}
