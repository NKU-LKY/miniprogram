import type { SpeciesArchiveDetail, SpeciesArchiveSummary } from '../../../types/species'
import { isValidSpeciesCategory } from '../../../data/species-categories'
import { buildSpeciesArchiveDetail, buildSpeciesArchiveSummaries } from '../../../utils/species-archive'
import { resolveSpeciesArchiveKey } from '../../../utils/species-migration'
import { getPostCommentCount, getPostLikeCount, listPublishedPosts } from './post'
import { mapObservationStatus, parseSpeciesFields, toFeedItem, toUserId } from './mappers'

async function loadArchivableObservations() {
  const posts = await listPublishedPosts({ page: 1, pageSize: 200 })
  const observations = []

  for (const post of posts.list) {
    if (!post.observation) continue
    const obs = post.observation
    const status = mapObservationStatus(obs.status, post.status)
    if (status === 'rejected' || status === 'pending_review' || status === 'withdrawn') continue

    const species = parseSpeciesFields(obs.species)
    if (!species.species_name) continue

    const obsId = toUserId(obs.obsId)
    const postId = String(post.postId)
    const [likeCount, commentCount] = await Promise.all([
      getPostLikeCount(postId).catch(() => 0),
      getPostCommentCount(postId).catch(() => 0),
    ])
    const feedItem = toFeedItem(post, likeCount, commentCount)
    if (!feedItem) continue

    observations.push({
      obs_id: obsId,
      user_id: toUserId(obs.user?.userId),
      species_name: species.species_name,
      species_remark: species.species_remark,
      location_name: obs.location?.name || '',
      note: obs.content || '',
      status,
      submitted_at: obs.submittedAt,
      photo_url: feedItem.photo_url,
      like_count: likeCount,
      comment_count: commentCount,
      is_featured: post.priority > 0,
    })
  }

  return observations
}

export async function listSpeciesArchivesRemote(): Promise<SpeciesArchiveSummary[]> {
  const observations = await loadArchivableObservations()
  return buildSpeciesArchiveSummaries(observations)
}

export async function getSpeciesArchiveRemote(speciesName: string): Promise<SpeciesArchiveDetail | null> {
  const name = speciesName.trim()
  if (!name) return null

  const categoryKey = isValidSpeciesCategory(name) ? name : resolveSpeciesArchiveKey(name)
  if (!categoryKey) return null

  const observations = await loadArchivableObservations()
  return buildSpeciesArchiveDetail(categoryKey, observations)
}
