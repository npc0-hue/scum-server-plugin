import assert from 'node:assert/strict'
import { localizeSettingKey } from '../resources/settingLocalization.js'

const cases = new Map([
  ['scum.ServerDescription', '服务器描述'],
  ['scum.MessageOfTheDay', '每日消息'],
  ['scum.HideKillNotification', '隐藏击杀通知'],
  ['scum.MaxAllowedExteriorZombies', '最大室外僵尸数'],
  ['scum.ExteriorZombieSpawnerCooldownTimer', '户外僵尸刷新冷却时间'],
  ['scum.AllowSectorRespawn', '允许区域复活'],
  ['scum.FuelDrainFromEngineMultiplier', '引擎燃油消耗倍率'],
  ['scum.SidecarBikeMaxFunctionalAmount', '边三轮摩托最大可用数量'],
  ['scum.DropshipDamageMultiplier', '空投飞船伤害倍率'],
  ['scum.MinServerTickRate', '最小服务器帧率'],
  ['scum.EncounterBaseCharacterAmountMultiplier', '遭遇基础角色数量倍率'],
  ['scum.EncounterCanClampCharacterNumWhenOutOfResources', '资源不足时限制遭遇角色数量'],
  ['scum.WeaponRackStartDecayingIfFlagAreaHasMoreThan', '旗帜区域武器架超过上限后开始腐坏'],
  ['scum.WaterProximityReplenishTimeoutMultiplier', '水邻近补给超时倍率'],
  ['scum.QuestsGlobalCycleDuration', '任务全局周期时长'],
  ['scum.MaxAllowedNPCs', '最大非玩家角色数量'],
  ['scum.ArmedNPCHealthMultiplier', '武装非玩家角色生命倍率'],
  ['scum.ProbabilityForArmedNPCToDropItemFromHandsWhenSearched', '搜索时武装非玩家角色手持物品掉落概率'],
  ['scum.EnableBCULocking', '启用 BCU 锁定'],
  ['scum.RaidProtectionGlobalShouldShowRaidStartEndMessages', '袭击保护全局应显示袭击开始结束消息'],
  ['scum.RaidProtectionGlobalShouldShowRaidTimesMessage', '全局显示袭击时段消息'],
])

for (const [key, expected] of cases) {
  assert.equal(localizeSettingKey(key), expected, `${key} should localize to ${expected}`)
}

assert.equal(localizeSettingKey(''), '')
assert.equal(localizeSettingKey('scum.UnknownSettingKey'), '')

console.log('setting localization checks passed')
