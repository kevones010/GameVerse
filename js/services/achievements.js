// Conquistas da Vee: selos calculados a partir da comunidade e da coleção.
// Lógica pura (testável): recebe os números e devolve a lista com progresso.

export const ACHIEVEMENTS = [
  { id: 'first-post', title: 'Primeira publicação', description: 'Publicou na comunidade pela primeira vez.', icon: 'assets/vee/avatars/vee-avatar-happy.webp', goal: 1, value: (s) => s.community.posts },
  { id: 'guide-master', title: 'Mestre dos guias', description: 'Escreveu 3 guias para ajudar outros jogadores.', icon: 'assets/vee/avatars/vee-avatar-blue.webp', goal: 3, value: (s) => s.community.byType.guide || 0 },
  { id: 'critic', title: 'Crítico', description: 'Escreveu 5 análises de jogos.', icon: 'assets/vee/avatars/vee-avatar-purple.webp', goal: 5, value: (s) => (s.player?.analysesCount || 0) + (s.community.byType.review || 0), local: true },
  { id: 'talkative', title: 'Conversador', description: 'Fez 5 comentários na comunidade.', icon: 'assets/vee/avatars/vee-avatar-green.webp', goal: 5, value: (s) => s.community.comments },
  { id: 'beloved', title: 'Querido pela comunidade', description: 'Recebeu 10 curtidas nas publicações.', icon: 'assets/vee/avatars/vee-avatar-pink.webp', goal: 10, value: (s) => s.community.likesReceived },
  { id: 'popular', title: 'Popular', description: 'Tem 3 seguidores.', icon: 'assets/vee/states/vee-favorite.webp', goal: 3, value: (s) => s.community.followers },
  { id: 'collector', title: 'Colecionador', description: 'Tem 10 jogos na coleção.', icon: 'assets/vee/transition/vee-idle.webp', goal: 10, value: (s) => s.player?.total || 0, local: true },
  { id: 'finisher', title: 'Zerador', description: 'Zerou 10 jogos.', icon: 'assets/vee/transition/vee-jump.webp', goal: 10, value: (s) => s.player?.completed || 0, local: true },
  { id: 'explorer', title: 'Explorador', description: 'Tem jogos de 6 gêneros diferentes.', icon: 'assets/vee/effects/portal.webp', goal: 6, value: (s) => s.player?.genresCount || 0, local: true },
  { id: 'rater', title: 'Avaliador', description: 'Deu nota para 10 jogos.', icon: 'assets/vee/avatars/vee-avatar-default.webp', goal: 10, value: (s) => s.player?.ratingsCount || 0, local: true }
];

/**
 * @param {{ community: object, player: object|null }} stats
 *   player = null para perfis de outras pessoas (a coleção só existe neste navegador).
 */
export function computeAchievements(stats) {
  return ACHIEVEMENTS
    .filter((achievement) => !achievement.local || stats.player)
    .map((achievement) => {
      const current = Math.max(0, Number(achievement.value(stats)) || 0);
      return {
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        goal: achievement.goal,
        progress: Math.min(current, achievement.goal),
        unlocked: current >= achievement.goal
      };
    })
    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked));
}
