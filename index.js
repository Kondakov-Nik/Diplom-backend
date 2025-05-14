require('dotenv').config()
const express = require('express')
const sequelize = require('./db')
const models = require('./models/models')
const cors = require('cors')
const fileUpload = require('express-fileupload')
const router = require('./routes/index')
const errorHandler = require('./middleware/ErrorHandlingMiddleware')
const path = require('path')

const PORT = process.env.PORT || 5001

const app = express()
app.use(cors({
    origin: 'http://localhost:5173', // Замените на ваш фронтенд-URL
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'X-Report-Id', 'Content-Type'],
    exposedHeaders: ['X-Report-Id'], // Разрешаем клиенту видеть этот заголовок
  }));
app.use(express.json())
app.use(express.static(path.resolve(__dirname, 'static')))
/* app.use(fileUpload({})) */
app.use('/api', router)

// Настройка обслуживания статических файлов
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Обработка ошибок, последний Middleware
app.use(errorHandler)

const start = async () => {
    try {
        await sequelize.authenticate()
        await sequelize.sync()
        //await sequelize.sync({ force: true })
        app.listen(PORT, () => console.log(`Server started on port ${PORT}`))

    } catch (e) {
        console.log(e)
    }

    
}


start()
