// utils/waitForStandby.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Polls the UserConv table every `interval` milliseconds until status is 'standby'.
 * @param {String} userId - The user ID to query.
 * @param {String} apiId - The API ID to query.
 * @param {Number} interval - Polling interval in milliseconds (default: 2000ms).
 * @returns {Promise<void>} - Resolves when status is 'standby'.
 */
function waitForStandby(userId, apiId, interval = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const userConv = await prisma.UserConv.findFirst({
          where: {
            userId_apiId: {
              userId: userId,
              apiId: last10Chars,
            },
          },
          select: {
            status: true,
          },
        });

        if (!userConv) {
          clearInterval(timer);
          return reject(new Error('UserConv record not found.'));
        }

        console.log(
          `Current status: '${userConv.status}'. Waiting for 'standby'...`,
        );

        if (userConv.status === 'standby') {
          clearInterval(timer);
          console.log('Status is now standby. Proceeding to the next step.');
          return resolve();
        }
      } catch (error) {
        clearInterval(timer);
        return reject(error);
      }
    }, interval);
  });
}

module.exports = waitForStandby;
