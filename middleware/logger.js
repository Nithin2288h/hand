const morgan = require('morgan');

const logger = morgan(':method :url :status :response-time ms - :res[content-length]');

module.exports = logger;
