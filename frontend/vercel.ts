const apiOrigin = process.env.RENDER_API_ORIGIN?.replace(/\/+$/, '');

if (!apiOrigin?.startsWith('https://')) {
  throw new Error(
    'Configure RENDER_API_ORIGIN com o endereço HTTPS da API.'
  );
}

export const config = {
  rewrites: [
    {
      source: '/api/:path*',
      destination: `${apiOrigin}/api/:path*`,
    },
    {
      source: '/(.*)',
      destination: '/index.html',
    },
  ],
};