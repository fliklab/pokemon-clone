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

export function chooseSkill(attacker: Battler): Skill {
  const preferred = skills.find((skill) => skill.type === attacker.type)
  return preferred ?? getSkillById(DEFAULT_SKILL_ID)
}
