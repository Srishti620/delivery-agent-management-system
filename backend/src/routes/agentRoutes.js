const express = require('express');

function createAgentRouter(controller) {
  const router = express.Router();

  router.post('/', controller.create); //            201 Created
  router.get('/', controller.list); //               200 OK (paginated)
  router.get('/:agentId', controller.get); //        200 OK / 404
  router.put('/:agentId', controller.replace); //    200 OK / 404 (full update)
  router.patch('/:agentId', controller.patch); //    200 OK / 404 (partial update)
  router.delete('/:agentId', controller.remove); //  204 No Content / 404

  return router;
}

module.exports = createAgentRouter;
