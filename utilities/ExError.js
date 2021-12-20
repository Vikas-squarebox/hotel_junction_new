class ExError extends Error {
  constructor(message, code) {
    // super();
    super(message);
    this.code = code;
  }
}

module.exports = ExError;
