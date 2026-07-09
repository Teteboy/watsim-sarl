/**
 * Campay Configuration Verification Script
 * Validates .env configuration without requiring a running server
 */

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');

class ConfigVerifier {
  constructor() {
    this.results = [];
    this.config = {};
  }

  parseEnvFile() {
    const content = fs.readFileSync(ENV_PATH, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      this.config[key] = value;
    }
  }

  runAllChecks() {
    console.log('\ud83d\udd0d Campay Configuration Verification\n');
    
    this.parseEnvFile();
    
    // 1. Check Campay is enabled
    this.checkBoolean('USE_CAMPAY', true, 'Campay integration enabled');
    
    // 2. Check base URL
    this.checkValue('CAMPAY_BASE_URL', 'https://demo.campay.net', 'Sandbox URL configured');
    
    // 3. Check credentials are present
    this.checkNotEmpty('CAMPAY_USERNAME', 'Campay username configured');
    this.checkNotEmpty('CAMPAY_PASSWORD', 'Campay password configured');
    this.checkNotEmpty('CAMPAY_WEBHOOK_KEY', 'Campay webhook key configured');
    
    // 4. Check credential format
    this.checkCredentialFormat();
    
    // 5. Check mock payments disabled
    this.checkBoolean('USE_MOCK_PAYMENTS', false, 'Mock payments disabled (real payments)');
    
    // 6. Check node environment
    this.checkValue('NODE_ENV', 'development', 'Development environment (sandbox mode)');
    
    // 7. Check other providers (should be empty when using Campay)
    this.checkOptionalEmpty('ORANGE_MONEY_MERCHANT_KEY', 'Orange Money direct (optional with Campay)');
    this.checkOptionalEmpty('MTN_MOMO_SUBSCRIPTION_KEY', 'MTN MoMo direct (optional with Campay)');
    
    this.printResults();
  }

  checkBoolean(key, expected, description) {
    const value = this.config[key];
    const isTrue = value === 'true' || value === '1' || value === 'yes';
    const isFalse = value === 'false' || value === '0' || value === 'no';
    
    if (expected && isTrue) {
      this.addResult(description, true, `${key}=${value}`);
    } else if (!expected && isFalse) {
      this.addResult(description, true, `${key}=${value}`);
    } else {
      this.addResult(description, false, `${key}=${value} (expected ${expected})`);
    }
  }

  checkValue(key, expected, description) {
    const value = this.config[key];
    if (value === expected) {
      this.addResult(description, true, `${key}=${value}`);
    } else {
      this.addResult(description, false, `${key}=${value} (expected ${expected})`);
    }
  }

  checkNotEmpty(key, description) {
    const value = this.config[key];
    if (value && value.length > 10) {
      const masked = value.substring(0, 8) + '...' + value.substring(value.length - 4);
      this.addResult(description, true, `${key}=${masked} (${value.length} chars)`);
    } else if (value && value.length > 0) {
      this.addResult(description, false, `${key} too short (${value.length} chars)`);
    } else {
      this.addResult(description, false, `${key} is empty`);
    }
  }

  checkCredentialFormat() {
    const username = this.config['CAMPAY_USERNAME'] || '';
    const password = this.config['CAMPAY_PASSWORD'] || '';
    const webhookKey = this.config['CAMPAY_WEBHOOK_KEY'] || '';
    
    // Check username format (typically base64-like)
    const usernameValid = username.length > 50 && /^[A-Za-z0-9_-]+$/.test(username);
    
    // Check password format
    const passwordValid = password.length > 50 && password.includes('-');
    
    // Check webhook key format
    const webhookValid = webhookKey.length > 50 && /^[A-Za-z0-9_-]+$/.test(webhookKey);
    
    if (usernameValid && passwordValid && webhookValid) {
      this.addResult('Credential format looks valid', true, 'All 3 credentials have expected format');
    } else {
      const issues = [];
      if (!usernameValid) issues.push('username format suspicious');
      if (!passwordValid) issues.push('password format suspicious');
      if (!webhookValid) issues.push('webhook key format suspicious');
      this.addResult('Credential format check', false, issues.join(', '));
    }
  }

  checkOptionalEmpty(key, description) {
    const value = this.config[key];
    if (!value || value === 'your_merchant_key' || value === 'your_subscription_key' || value === 'your_api_user' || value === 'your_api_key') {
      this.addResult(description, true, 'Not configured (using Campay instead)');
    } else {
      this.addResult(description, true, 'Configured (direct provider access)');
    }
  }

  addResult(description, success, detail) {
    this.results.push({ description, success, detail });
    const icon = success ? '\u2705' : '\u274c';
    console.log(`${icon} ${description}`);
    console.log(`   ${detail}\n`);
  }

  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('\ud83d\udcca Summary');
    console.log('='.repeat(50));
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    
    console.log(`Checks passed: ${passed}/${total}`);
    
    if (failed === 0) {
      console.log('\n\ud83c\udf89 All configuration checks passed!');
      console.log('\ud83d\ude80 Ready for Campay sandbox testing');
      console.log('\nNext steps:');
      console.log('  1. Start the backend server: npm run dev');
      console.log('  2. Test payments through the mobile app');
      console.log('  3. Monitor server logs for Campay API responses');
    } else {
      console.log(`\n\u26a0\ufe0f  ${failed} check(s) failed`);
      console.log('\nPlease review the failed checks above.');
    }
  }
}

// Run verification
if (require.main === module) {
  try {
    const verifier = new ConfigVerifier();
    verifier.runAllChecks();
  } catch (error) {
    console.error('\u274c Verification failed:', error.message);
    process.exit(1);
  }
}

module.exports = ConfigVerifier;
