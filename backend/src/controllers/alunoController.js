const { criarAlunoDTO, editarAlunoDTO, alterarStatusAlunoDTO, getAlunoDTO } = require('../dtos/alunoDTO');
const { lerPaginacao } = require('../dtos/paginacaoDTO');
const { editarAlunoService, criarAlunoService, listarAlunosService, obterAlunoService, obterOficinasService, obterAtendimentosService, alterarStatusAlunoService, excluirAlunoService } = require('../services/alunoService');


async function criarAluno(req, res) {
  try {
    const dadosValidados = criarAlunoDTO.parse(req.body);
    
    const aluno = await criarAlunoService(dadosValidados);
    
    return res.status(201).json(aluno);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ erros: error.issues });
    }
    if (error.isConflict) return res.status(409).json({ erro: error.message, conflitos: error.detalhes });
    if ([400, 404].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
    console.error('Erro ao cadastrar aluno.', { nome: error.name, codigo: error.code });
    return res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
}

async function listarAlunos(req, res) {
  try {
    const alunos = await listarAlunosService(lerPaginacao(req.query));
    return res.status(200).json(alunos);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if (error.statusCode === 400) return res.status(400).json({ erro: error.message });
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao listar alunos.' });
  }
}

async function obterAluno(req, res) {
  try {
    const { id } = getAlunoDTO.parse(req.params);

    const aluno = await obterAlunoService(id);
    if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado.' });
    return res.status(200).json(aluno);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao obter aluno.' });
  }
}

async function obterOficinas(req, res) {
  try {
    const { id } = getAlunoDTO.parse(req.params);

    const oficinas = await obterOficinasService(id, lerPaginacao(req.query));
    return res.status(200).json(oficinas);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if ([400, 404].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao obter oficinas.' });
  }
}

async function obterAtendimentos(req, res) {
  try {
    const { id } = getAlunoDTO.parse(req.params);

    const atendimentos = await obterAtendimentosService(id, lerPaginacao(req.query));
    return res.status(200).json(atendimentos);
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if ([400, 404].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao obter atendimentos.' });
  }
}

async function editarAluno(req, res) {
  try {
    const { id } = getAlunoDTO.parse(req.params);
    await editarAlunoService(id, editarAlunoDTO.parse(req.body));
    return res.status(200).json(await obterAlunoService(id));
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if (error.confirmacao) return res.status(409).json({ erro: error.message, confirmacao: error.confirmacao, conflitos: error.detalhes });
    if (error.isConflict) return res.status(409).json({ erro: error.message, conflitos: error.detalhes });
    if ([400, 404, 409].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
    console.error('Erro ao editar aluno.', { nome: error.name, codigo: error.code });
    return res.status(500).json({ erro: 'Erro interno ao editar aluno.' });
  }
}

async function alterarStatusAluno(req, res) {
  try {
    const { id } = getAlunoDTO.parse(req.params);
    const dados = alterarStatusAlunoDTO.parse(req.body);
    return res.status(200).json(await alterarStatusAlunoService(id, dados));
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if ([400, 404, 409].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
    console.error('Erro ao alterar status do aluno.', { nome: error.name, codigo: error.code });
    return res.status(500).json({ erro: 'Erro interno ao alterar status do aluno.' });
  }
}

async function excluirAluno(req, res) {
  try {
    const { id } = getAlunoDTO.parse(req.params);
    await excluirAlunoService(id);
    return res.status(204).send();
  } catch (error) {
    if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
    if (error.statusCode === 404) return res.status(404).json({ erro: error.message });
    console.error('Erro ao excluir aluno.', { nome: error.name, codigo: error.code });
    return res.status(500).json({ erro: 'Erro interno ao excluir aluno.' });
  }
}

module.exports = { editarAluno, criarAluno, listarAlunos, obterAluno, obterOficinas, obterAtendimentos, alterarStatusAluno, excluirAluno };
