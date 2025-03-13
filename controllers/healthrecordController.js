const ApiError = require('../error/ApiError');
const { User, Symptom, Medication, HealthRecord } = require('../models/models');


class HealthRecordController {
  // Получить все записи о симптомах и лекарствах
  async getAll(req, res, next) {
    try {
      let healthRecords = await HealthRecord.findAll();
      return res.json(healthRecords);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

    // Получить все записи для определенного пользователя на все даты
  async getAllByUser(req, res, next) {
    try {
      const { userId } = req.params;
      const healthRecords = await HealthRecord.findAll({
        where: { userId: userId },
        attributes: ['id', 'weight', 'dosage' ,'recordDate', 'notes'], // Укажите нужные поля
        include: [ 
          { model: Symptom, attributes: ['name'], required: false },
          { model: Medication, attributes: ['name'], required: false }
        ]
      });
      return res.json(healthRecords);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }


  // Получить записи для определенного пользователя на определенную дату
  async getByUserAndDate(req, res, next) {
    try {
      const { userId, recordDate } = req.params;  // Получаем userId и recordDate из параметров запроса

      // Ищем записи, которые соответствуют указанному userId и recordDate
      let healthRecords = await HealthRecord.findAll({
        where: {
          userId: userId,
          recordDate: recordDate
        }
      });

      if (healthRecords.length === 0) {
        return res.status(404).json({ message: 'No health records found for this user on the given date' });
      }

      return res.json(healthRecords);  // Возвращаем найденные записи
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  // Получить запись по id
  async getOne(req, res, next) {
    try {
      const { id } = req.params;
      let healthRecord = await HealthRecord.findOne({ where: { id } });

      if (!healthRecord) {
        return res.status(404).json({ message: 'Health record not found' });
      }

      return res.json(healthRecord);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

  // Контроллер для создания симптомов в календарь
  async createSymptom(req, res, next) {
    try {
      const { recordDate, weight, notes, userId, symptomId } = req.body;

      // Преобразуем строку с датой и временем в объект Date
      const recordDateTime = new Date(recordDate); 
      
      let healthRecord = await HealthRecord.create({
        recordDate: recordDateTime,  // Сохраняем дату и время
        weight,  // Тяжесть симптома (1-5)
        notes: null,    
        userId,
        symptomId,  // ID симптома
        medicationId: null  // Для симптома, лекарство не указывается
      });

      return res.status(201).json(healthRecord);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }

    // Контроллер для создания лекарств в календарь
  async createMedication(req, res, next) {
    try {
      const { recordDate, dosage, notes, userId, medicationId } = req.body;

      // Преобразуем строку с датой и временем в объект Date
      const recordDateTime = new Date(recordDate); 
      
      let healthRecord = await HealthRecord.create({
        recordDate: recordDateTime,  // Сохраняем дату и время
        dosage,  // Дозировка лекарства
        notes,   // Количество таблеток
        userId,
        medicationId,  // ID лекарства
        symptomId: null  // Для лекарства, симптом не указывается
      });

      return res.status(201).json(healthRecord);
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }



// Обновить существующую запись (общий для симптомов и лекарств)
async update(req, res, next) {
  try {
    const { id } = req.params;
    const { recordDate, weight, dosage, notes, userId, symptomId, medicationId } = req.body;

    // Проверка обязательных полей
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Находим запись по ID
    let healthRecord = await HealthRecord.findOne({ where: { id } });

    if (!healthRecord) {
      return res.status(404).json({ message: 'Health record not found' });
    }

    // Проверяем, что запись принадлежит текущему пользователю
    if (healthRecord.userId !== userId) {
      return res.status(403).json({ message: 'You are not authorized to update this record' });
    }

    // Обновляем только те поля, которые переданы в запросе
    healthRecord.recordDate = recordDate ? new Date(recordDate) : healthRecord.recordDate;
    healthRecord.weight = weight !== undefined ? weight : healthRecord.weight;
    healthRecord.dosage = dosage !== undefined ? dosage : healthRecord.dosage;
    healthRecord.notes = notes !== undefined ? notes : healthRecord.notes;
    healthRecord.symptomId = symptomId !== undefined ? symptomId : healthRecord.symptomId;
    healthRecord.medicationId = medicationId !== undefined ? medicationId : healthRecord.medicationId;

    // Сохраняем изменения
    await healthRecord.save();

    return res.status(200).json(healthRecord);
  } catch (error) {
    next(ApiError.badRequest(error.message));
  }
}

  // Удалить запись
  async delete(req, res, next) {
    try {
      const { id } = req.params;
      let healthRecord = await HealthRecord.findOne({ where: { id } });

      if (!healthRecord) {
        return res.status(404).json({ message: 'Health record not found' });
      }

      await healthRecord.destroy();
      return res.json({ message: 'Health record deleted successfully' });
    } catch (error) {
      next(ApiError.badRequest(error.message));
    }
  }
}

module.exports = new HealthRecordController();
