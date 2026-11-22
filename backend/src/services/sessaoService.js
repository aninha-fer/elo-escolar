const { promisify } = require('node:util');
const prisma = require('../prismaClient');
const { INATIVIDADE_MAXIMA_MS, DURACAO_MAXIMA_MS } = require('../config/prazosSessao');

async function encerrarSessao(req, res) {
  if (req.session) await promisify(req.session.destroy).call(req.session);
  res.clearCookie('elo.sid', { path: '/api' });
  return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
}

async function registrarAtividade(sid, sessao) {
  const agora = Date.now();
  // UPDATE não recria sessões removidas. Atualizar só este campo também evita
  // sobrescrever credenciais ou fazer a atividade retroceder entre abas.
  const atualizadas = await prisma.$executeRaw`
    UPDATE "session" AS s
    SET sess = jsonb_set(s.sess::jsonb, '{ultimaAtividadeEm}',
      to_jsonb(GREATEST((s.sess->>'ultimaAtividadeEm')::bigint, ${agora}::bigint)))::json,
      expire = GREATEST(s.expire, ${new Date(agora + INATIVIDADE_MAXIMA_MS)}::timestamp)
    FROM usuario u JOIN pessoa p ON p.id = u.pessoa_id
      LEFT JOIN funcionario f ON f.pessoa_id = p.id
    WHERE s.sid = ${sid} AND s.expire > ${new Date(agora)}::timestamp
      AND s.sess->>'usuarioId' = ${String(sessao.usuarioId)}
      AND s.sess->>'senha_versao' = ${String(sessao.senha_versao)}
      AND s.sess->>'autenticadoEm' = ${String(sessao.autenticadoEm)}
      AND (s.sess->>'ultimaAtividadeEm')::bigint > ${agora - INATIVIDADE_MAXIMA_MS}::bigint
      AND (s.sess->>'autenticadoEm')::bigint > ${agora - DURACAO_MAXIMA_MS}::bigint
      AND u.id = ${sessao.usuarioId} AND u.senha_versao = ${sessao.senha_versao}
      AND u.status = 'ATIVO' AND u.deleted_at IS NULL
      AND p.status_geral = 'ATIVO' AND f.deleted_at IS NULL
  `;
  return atualizadas === 1;
}

module.exports = { encerrarSessao, registrarAtividade };
