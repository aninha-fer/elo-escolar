UPDATE "funcionario"
SET "cargo" = 'Clínico'
WHERE lower(btrim("cargo")) = 'terapeuta';
