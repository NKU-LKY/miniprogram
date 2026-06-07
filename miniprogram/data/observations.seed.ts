/**
 * 本地种子数据 —— 预制观测记录
 * 迁移至云服务器后端后，可删除整个 data/ 目录
 */
import type { Observation } from '../types/observation'
import { getLocationByName } from './locations'

const DEFAULT_PHOTO =
  'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

function atLocation(name: string): Pick<Observation, 'location_name' | 'latitude' | 'longitude'> {
  const point = getLocationByName(name)
  if (!point) {
    return { location_name: name }
  }
  return {
    location_name: point.name,
    latitude: point.latitude,
    longitude: point.longitude,
  }
}

export const SEED_OBSERVATIONS: Omit<Observation, 'obs_id'>[] = [
  {
    user_id: 'seed_3',
    species_name: '橘猫',
    ...atLocation('理科食堂'),
    note: '理科食堂门口有只超乖的橘猫！',
    status: 'approved',
    submitted_at: '2026-06-05T10:30:00.000Z',
    photo_url: DEFAULT_PHOTO,
    like_count: 28,
    comment_count: 6,
    is_featured: true,
  },
  {
    user_id: 'seed_3',
    species_name: '银杏',
    ...atLocation('图书馆'),
    note: '图书馆旁银杏叶色很美，阳光洒下来特别好看。',
    status: 'approved',
    submitted_at: '2026-06-04T15:20:00.000Z',
    photo_url: DEFAULT_PHOTO,
    like_count: 15,
    comment_count: 2,
  },
  {
    user_id: 'seed_3',
    species_name: '麻雀',
    ...atLocation('公教楼C区'),
    note: '公教楼C区常见的小麻雀，不怕人。',
    status: 'approved',
    submitted_at: '2026-06-03T08:45:00.000Z',
    photo_url: DEFAULT_PHOTO,
    like_count: 9,
    comment_count: 4,
  },
  {
    user_id: 'seed_3',
    species_name: '樱花',
    ...atLocation('东北角湿地'),
    note: '东北角湿地旁落英缤纷，春天真的太美了！',
    status: 'approved',
    submitted_at: '2026-06-02T12:00:00.000Z',
    photo_url: DEFAULT_PHOTO,
    like_count: 42,
    comment_count: 11,
    is_featured: true,
  },
  {
    user_id: 'seed_3',
    ...atLocation('体育馆'),
    note: '体育馆边发现一只小鸟，有人认识吗？',
    status: 'needs_identification',
    submitted_at: '2026-06-01T17:30:00.000Z',
    photo_url: DEFAULT_PHOTO,
    like_count: 7,
    comment_count: 1,
  },
  {
    user_id: 'seed_3',
    species_name: '桂花',
    ...atLocation('计网学院楼'),
    note: '计网学院楼旁的桂花开了，整个空气都是香的。',
    status: 'approved',
    submitted_at: '2026-05-31T09:15:00.000Z',
    photo_url: DEFAULT_PHOTO,
    like_count: 19,
    comment_count: 3,
  },
  {
    user_id: 'seed_3',
    species_name: '喜鹊',
    ...atLocation('理科学9'),
    note: '理科学9前的喜鹊在草地上找吃的，尾巴长长的很漂亮。',
    status: 'identified',
    submitted_at: '2026-05-30T14:40:00.000Z',
    photo_url: DEFAULT_PHOTO,
    like_count: 11,
    comment_count: 5,
  },
  {
    user_id: 'seed_3',
    species_name: '竹子',
    ...atLocation('公教楼C区'),
    note: '公教楼C区旁的竹子绿油油的，风吹过沙沙作响。',
    status: 'approved',
    submitted_at: '2026-05-29T11:20:00.000Z',
    photo_url: DEFAULT_PHOTO,
    like_count: 8,
    comment_count: 2,
  },
  {
    user_id: 'seed_3',
    species_name: '蝴蝶',
    ...atLocation('理科体育场'),
    note: '理科体育场边有只白色蝴蝶停在草丛上，翅膀上的花纹很精致。',
    status: 'approved',
    submitted_at: '2026-05-28T16:00:00.000Z',
    photo_url: DEFAULT_PHOTO,
    like_count: 23,
    comment_count: 7,
  },
  {
    user_id: 'seed_3',
    species_name: '锦鲤',
    ...atLocation('东北角湿地'),
    note: '东北角湿地的锦鲤游来游去，红色的那条最抢眼。',
    status: 'approved',
    submitted_at: '2026-05-27T10:10:00.000Z',
    photo_url: DEFAULT_PHOTO,
    like_count: 31,
    comment_count: 9,
  },
]

/** 种子数据中出现过的物种名，用于筛选「其他」物种 */
export const SEED_SPECIES_NAMES = Array.from(
  new Set(
    SEED_OBSERVATIONS.map((item) => (item.species_name || '').trim()).filter((name) => name.length > 0),
  ),
)
