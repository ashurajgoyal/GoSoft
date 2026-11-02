import 'dotenv/config';

const required = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env variable: ${key}`);
}

const isProd = process.env.NODE_ENV === 'production';
if (isProd && /change-me/.test(process.env.JWT_ACCESS_SECRET + process.env.JWT_REFRESH_SECRET)) {
  throw new Error('Refusing to start in production with default JWT secrets');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI,
  clientOrigins: (process.env.CLIENT_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim()),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  encryptionKey: process.env.DATA_ENCRYPTION_KEY,
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'GO SOFT <no-reply@gosoft.in>',
  },
  support: {
    email: process.env.SUPPORT_EMAIL || 'support@gosoft.in',
    phone: process.env.SUPPORT_PHONE || '',
  },
  superAdmin: {
    name: process.env.SUPERADMIN_NAME || 'GO SOFT Admin',
    email: process.env.SUPERADMIN_EMAIL,
    password: process.env.SUPERADMIN_PASSWORD,
  },
};
