const { z } = require('zod');

const loginDTO = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  senha: z.string().min(1).max(100),
});

module.exports = { loginDTO };