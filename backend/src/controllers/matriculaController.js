const { matricularOficinasDTO, cancelarOficinaParamsDTO, cancelarOficinaDTO,
  matricularRegularDTO, removerMatriculaProvisoriaDTO } = require('../dtos/matriculaDTO');
const { matricularOficinasService, cancelarOficinaService,
  matricularTurmaRegularService, removerMatriculaProvisoriaService } = require('../services/matriculaService');

async function criarMatriculasOficinas(req, res) {
  try {
    const dadosValidados = matricularOficinasDTO.parse(req.body);
    
    const resultado = await matricularOficinasService(dadosValidados);
    
    return res.status(201).json(resultado);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ erros: error.issues });
    }
    if (error.isConflict) {
      return res.status(409).json({ 
        erro: error.message, 
        conflitos: error.detalhes 
      });
    }
    if (error.message === 'Aluno não encontrado ou inativo.') {
        return res.status(404).json({ erro: error.message });
    }
    
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao processar matrículas.' });
  }
}

async function cancelarInscricaoOficina(req, res) {
  try {
    const { matricula_id } = cancelarOficinaParamsDTO.parse(req.params);
    const { aluno_id } = cancelarOficinaDTO.parse(req.body);
    const resultado = await cancelarOficinaService({ aluno_id, matricula_id });
    return res.status(200).json(resultado);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ erros: error.issues });
    }
    if (error.statusCode === 404 || error.statusCode === 409) {
      return res.status(error.statusCode).json({ erro: error.message });
    }
    console.error(error);
    return res.status(500).json({ erro: 'Erro interno ao cancelar a inscrição.' });
  }
}

function responderErroVinculo(error, res) {
  if (error.name === 'ZodError') return res.status(400).json({ erros: error.issues });
  if (error.isConflict) return res.status(409).json({ erro: error.message, conflitos: error.detalhes });
  if ([400, 404, 409].includes(error.statusCode)) return res.status(error.statusCode).json({ erro: error.message });
  console.error(error);
  return res.status(500).json({ erro: 'Erro interno ao processar o vínculo.' });
}

async function criarMatriculaRegular(req, res) {
  try {
    const dados = matricularRegularDTO.parse(req.body);
    return res.status(201).json(await matricularTurmaRegularService(dados));
  } catch (error) {
    return responderErroVinculo(error, res);
  }
}

async function removerMatriculaProvisoria(req, res) {
  try {
    const dados = removerMatriculaProvisoriaDTO.parse(req.params);
    return res.status(200).json(await removerMatriculaProvisoriaService(dados));
  } catch (error) {
    return responderErroVinculo(error, res);
  }
}

module.exports = { criarMatriculasOficinas, cancelarInscricaoOficina, criarMatriculaRegular, removerMatriculaProvisoria };
