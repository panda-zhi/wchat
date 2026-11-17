/** 自提码：4 位数字，首位非 0，避免与字符串前导零混淆。 */

function genPickupCode() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

function isValidPickupCode(code) {
  return /^[1-9]\d{3}$/.test(String(code))
}

module.exports = { genPickupCode, isValidPickupCode }
