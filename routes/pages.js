const express = require('express');
const router = express.Router();
const pagesController = require('../controllers/pagesController');
const { mockAuth } = require('../middleware/mockAuth');

router.get('/', pagesController.showIndex);
router.get('/item/:id', pagesController.showItem);
router.get('/login', pagesController.showLogin);
// добавление доступно только после проверки авторизации
router.get('/add', mockAuth, pagesController.showAddForm);
router.post('/add', mockAuth, pagesController.createItem);
router.get('/error-test', pagesController.triggerError);

module.exports = router;
