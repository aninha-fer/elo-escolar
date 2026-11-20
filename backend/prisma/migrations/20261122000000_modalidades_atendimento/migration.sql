BEGIN;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM atendimento_clinico WHERE length(btrim(modalidade, E' \t\n\r\v\f')) = 0 OR length(btrim(modalidade, E' \t\n\r\v\f')) > 200) THEN
    RAISE EXCEPTION 'Existem atendimentos com modalidade vazia ou maior que 200 caracteres. Corrija essas pendências antes de aplicar a migration.';
  END IF;
END $$;

CREATE TABLE modalidade (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  CONSTRAINT modalidade_nome_nao_vazio CHECK (length(btrim(nome)) > 0)
);
CREATE UNIQUE INDEX modalidade_nome_unico ON modalidade (lower(btrim(nome)));

INSERT INTO modalidade (nome) VALUES ('Psicologia');
INSERT INTO modalidade (nome)
SELECT DISTINCT ON (lower(btrim(modalidade, E' \t\n\r\v\f'))) btrim(modalidade, E' \t\n\r\v\f')
FROM atendimento_clinico
WHERE lower(btrim(modalidade, E' \t\n\r\v\f')) <> 'psicologia'
ORDER BY lower(btrim(modalidade, E' \t\n\r\v\f')), id;

ALTER TABLE atendimento_clinico ADD COLUMN modalidade_id INTEGER;
UPDATE atendimento_clinico a SET modalidade_id = m.id
FROM modalidade m WHERE lower(btrim(a.modalidade, E' \t\n\r\v\f')) = lower(m.nome);
ALTER TABLE atendimento_clinico ALTER COLUMN modalidade_id SET NOT NULL;
ALTER TABLE atendimento_clinico ADD CONSTRAINT atendimento_clinico_modalidade_id_fkey FOREIGN KEY (modalidade_id) REFERENCES modalidade(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX atendimento_clinico_modalidade_id_idx ON atendimento_clinico(modalidade_id);
ALTER TABLE atendimento_clinico DROP COLUMN modalidade;

COMMIT;
