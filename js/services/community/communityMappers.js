const UNKNOWN_USER = Object.freeze({
  id: "unknown",
  handle: "visitante",
  displayName: "Visitante",
  bio: "",
  avatar: "assets/vee/avatars/vee-avatar-default.webp",
  createdAt: ""
});

export function mapCommunityUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    handle: user.handle,
    displayName: user.displayName,
    bio: user.bio || "",
    avatar: user.avatar || "assets/vee/avatars/vee-avatar-default.webp",
    createdAt: user.createdAt || ""
  };
}

export function mapCommunityPost(post, author, interactionState = {}) {
  return {
    id: post.id,
    authorId: post.authorId,
    author: mapCommunityUser(author) || { ...UNKNOWN_USER },
    game: post.gameId === null ? null : {
      id: Number(post.gameId),
      name: post.gameName || "Jogo",
      slug: post.gameSlug || ""
    },
    type: post.type,
    title: post.title,
    content: post.content,
    media: Array.isArray(post.media) ? post.media.map((item) => ({ ...item })) : [],
    tags: Array.isArray(post.tags) ? [...post.tags] : [],
    spoiler: Boolean(post.spoiler),
    spoilerLabel: post.spoilerLabel || "",
    status: post.status,
    visibility: post.visibility,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    likesCount: Math.max(0, Number(post.likesCount) || 0),
    commentsCount: Math.max(0, Number(post.commentsCount) || 0),
    savesCount: Math.max(0, Number(post.savesCount) || 0),
    likedByCurrentUser: Boolean(interactionState.liked),
    savedByCurrentUser: Boolean(interactionState.saved)
  };
}

export function mapCommunityComment(comment, author) {
  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    author: mapCommunityUser(author) || { ...UNKNOWN_USER },
    parentCommentId: comment.parentCommentId || null,
    content: comment.content,
    spoiler: Boolean(comment.spoiler),
    status: comment.status,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  };
}
