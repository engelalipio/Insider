export const GAME_CONFIG = {
  width: 1280,
  height: 400,
  gravity: 900,
  playerSpeed: 180,
  jumpVelocity: -520,
  groundY: 340,
  // ── Combat ──────────────────────────────────────────────────────
  maxHp:               5,      // player hit points
  attackDamage:        1,      // damage per player slash
  guardMaxHp:          3,      // hits to kill a guard
  invincibilityTime:   1200,   // ms player is invincible after taking damage
  guardDamage:         1,      // damage per guard contact
  guardDamageCooldown: 900,    // ms between guard hits on player
};
