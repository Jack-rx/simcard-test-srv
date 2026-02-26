'use strict';

module.exports = {
  PORT:         process.env.PORT  || 3000,
  SECRET_TOKEN: process.env.TOKEN || 'mi_token_secreto',
  MAX_HISTORY:  100,
  CMD_TIMEOUT:  80_000,   // ms antes de marcar un comando como timeout
};
