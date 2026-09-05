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

export function mapCommunityPost(post, author) {
  return {
    id: post.id,
    author: mapCommunityUser(author) || {
      id: "unknown",
      handle: "visitante",
      displayName: "Visitante",
      bio: "",
      avatar: "assets/vee/avatars/vee-avatar-default.webp",
      createdAt: ""
    },
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
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    likesCount: Math.max(0, Number(post.likesCount) || 0),
    commentsCount: Math.max(0, Number(post.commentsCount) || 0),
    savesCount: Math.max(0, Number(post.savesCount) || 0)
  };
}
