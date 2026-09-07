const { criarAlunoDTO, getAlunoDTO } = require('../dtos/alunoDTO');
const { criarAlunoService, listarAlunosService, obterAlunoService, obterOficinasService } = require('../services/alunoService');


async function criarAluno(req, res) {
  try {
    const dadosValidados = criarAlunoDTO.parse(req.body);
    
    const aluno = await criarAlunoService(dadosValidados);
    
    return res.status(201).json(aluno);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ erros: error.issues });
    }
    if (error.message.includes('turma') || error.message.includes('turno')) {
      return res.status(400).json({ erro: error.message });
    }
    
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
}

async function listarAlunos(req, res) {
  try {
    const alunos = await listarAlunosService();
    return res.status(200).json(alunos);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao listar alunos.' });
  }
}

async function obterAluno(req, res) {
  try {
    const { id } = getAlunoDTO.parse(req.params);

    const aluno = await obterAlunoService(id);
    return res.status(200).json(aluno);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao obter aluno.' });
  }
}

async function obterOficinas(req, res) {
  try {
    const { id } = getAlunoDTO.parse(req.params);

    const oficinas = await obterOficinasService(id);
    return res.status(200).json(oficinas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao obter oficinas.' });
  }
}

module.exports = { criarAluno, listarAlunos, obterAluno, obterOficinas };