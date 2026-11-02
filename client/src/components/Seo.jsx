import { Helmet } from 'react-helmet-async';

const SITE = 'https://www.gosoft.in';

export function Seo({ title, description, path = '/', schema, canonical }) {
  const full = title ? `${title} | GO SOFT` : 'GO SOFT — Business Simplified. Growth Amplified.';
  return (
    <Helmet>
      <title>{full}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={canonical || SITE + path} />
      <meta property="og:title" content={full} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={SITE + path} />
      {schema && <script type="application/ld+json">{JSON.stringify(schema)}</script>}
    </Helmet>
  );
}
