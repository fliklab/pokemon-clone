import skillsData from '../data/skills.json'
import type { Battler, ElementType } from './types'

export type Skill = {
  id: string
  name: string
  type: ElementType
  power: number
  animation: 'whip' | 'burst' | 'wave' | 'spark' | 'slam'
  sfx: 'pluck' | 'flame' | 'splash' | 'zap' | 'hit'
}

const skills = skillsData as Skill[]

const DEFAULT_SKILL_ID = 'tackle'

export function getSkillById(skillId: string): Skill {
  return skills.find((skill) => skill.id === skillId) ?? skills.find((skill) => skill.id === DEFAULT_SKILL_ID) ?? skills[0]
}

export function resolveSkillSlots(attacker: Battler): Skill[] {
  const picked = (attacker.knownSkills ?? [])
    .map((skillId) => getSkillById(skillId))
    .slice(0, 4)

  if (picked.length > 0) {
    return picked
  }

  const preferred = skills.find((skill) => skill.type === attacker.type)
  const defaultSet = [preferred, getSkillById(DEFAULT_SKILL_ID), ...skills]
    .filter((skill): skill is Skill => Boolean(skill))

  const deduped: Skill[] = []
  for (const skill of defaultSet) {
    if (!deduped.some((entry) => entry.id === skill.id)) {
      deduped.push(skill)
    }
    if (deduped.length === 4) {
      break
    }
  }

  return deduped
}

export function chooseSkill(attacker: Battler): Skill {
  const pool = resolveSkillSlots(attacker)
  const roll = Math.floor(Math.random() * pool.length)
  return pool[Math.max(0, Math.min(pool.length - 1, roll))]
}
