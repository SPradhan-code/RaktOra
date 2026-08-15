/**
 * Centralized Environment & Security Configuration Validator
 * Validates essential secrets and database credentials on application startup.
 */

function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === 'production';
  const warnings = [];
  const errors = [];

  // 1. JWT_SECRET Validation
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || !jwtSecret.trim()) {
    errors.push('JWT_SECRET is missing. Define a strong, cryptographically secure JWT_SECRET in your environment.');
  } else {
    const trimmedSecret = jwtSecret.trim();
    const trivialSecrets = ['secret', 'jwt_secret', '123456', 'admin', 'password', 'default_secret'];
    
    if (trivialSecrets.includes(trimmedSecret.toLowerCase())) {
      errors.push('JWT_SECRET uses a known insecure default value. Please generate a random secret.');
    } else if (trimmedSecret.length < 16) {
      if (isProduction) {
        errors.push('JWT_SECRET must be at least 16 characters long in production environments.');
      } else {
        warnings.push('JWT_SECRET is shorter than 16 characters. Consider using a longer key for optimal security.');
      }
    }
  }

  // 2. Database Configuration Validation
  const hasDatabaseUrl = !!(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
  const hasIndividualDbConfig = !!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);

  if (!hasDatabaseUrl && !hasIndividualDbConfig) {
    warnings.push('No database connection settings found. Ensure DATABASE_URL or DB_HOST/DB_USER/DB_NAME are configured.');
  }

  // 3. Admin Registration Secret
  if (!process.env.ADMIN_REGISTRATION_SECRET || !process.env.ADMIN_REGISTRATION_SECRET.trim()) {
    warnings.push('ADMIN_REGISTRATION_SECRET is unset. Administrator registration endpoint will fail closed (403).');
  }

  if (errors.length > 0) {
    console.error('\n❌ CRITICAL ENVIRONMENT CONFIGURATION ERRORS:');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('\nPlease fix the above configuration errors before starting RaktOra.\n');
    if (isProduction || require.main === module) {
      process.exit(1);
    }
    return { isValid: false, errors, warnings };
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('\n⚠️ ENVIRONMENT CONFIGURATION WARNINGS:');
    warnings.forEach(warn => console.warn(`  - ${warn}`));
    console.warn('');
  }

  return { isValid: true, warnings, errors: [] };
}

module.exports = {
  validateEnvironment
};
