const jwt = require('jsonwebtoken')

module.exports = function (req, res, next) {
    // Разрешаем предварительный OPTIONS-запрос
    if (req.method === "OPTIONS") {
        return next();
    }

    try {
        // Получаем токен из заголовков
        const token = req.headers.authorization.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: "Не авторизован" });
        }

        // Декодируем токен
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.user = decoded;  // Сохраняем данные пользователя в запросе

        // Проверка соответствия ID пользователя в токене и в запросе
        const userId = req.params.id || req.body.userId; // Получаем ID из параметров или тела запроса
        if (userId && userId !== String(decoded.id)) {   // Сравниваем ID
            return res.status(403).json({ message: "Нет прав для изменения данных" });
        }

        next(); // Продолжаем выполнение запроса
    } catch (e) {
        res.status(401).json({ message: "Не авторизован" });
    }
};
