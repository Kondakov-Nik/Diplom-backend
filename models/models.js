const sequelize = require('../db');
const { DataTypes } = require('sequelize');

// Модель пользователя
const User = sequelize.define('user', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true },
  birthDate: { type: DataTypes.DATEONLY, allowNull: false },
  password: { type: DataTypes.STRING }
}, {
  getterMethods: {
    age() {
      const birthDate = new Date(this.birthDate);
      const age = new Date().getFullYear() - birthDate.getFullYear();
      const monthDifference = new Date().getMonth() - birthDate.getMonth();
      if (monthDifference < 0 || (monthDifference === 0 && new Date().getDate() < birthDate.getDate())) {
        return age - 1;
      }
      return age;
    }
  }
});

// Модель симптома
const Symptom = sequelize.define('symptom', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  isCustom: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// Модель лекарства
const Medication = sequelize.define('medication', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  isCustom: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// Модель записи о симптомах и лекарствах
const HealthRecord = sequelize.define('healthRecord', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  recordDate: { type: DataTypes.DATE, allowNull: false },
  weight: { type: DataTypes.INTEGER, allowNull: true },
  dosage: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true }
});

// Модель для анализов
const Analysis = sequelize.define('analysis', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false }, // Название анализа (например, "Анализ крови")
  filePath: { type: DataTypes.STRING, allowNull: false }, // Путь к файлу (фото или PDF)
  recordDate: { type: DataTypes.DATE, allowNull: false } // Дата анализа, берётся из FullCalendar
});

// Модель сгенерированных отчётов
const Report = sequelize.define('report', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  type: { 
    type: DataTypes.ENUM('symptoms', 'medications'),
    allowNull: false 
  },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: false },
  filePath: { type: DataTypes.STRING, allowNull: false }
});

// Модель для хранения данных KP-индекса
const KpIndex = sequelize.define('kpindex', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  date: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
  kpIndex: { type: DataTypes.FLOAT, allowNull: false }
});

// Определение связей
User.hasMany(HealthRecord);
HealthRecord.belongsTo(User);

User.hasMany(Report);
Report.belongsTo(User);

Symptom.hasMany(HealthRecord);
HealthRecord.belongsTo(Symptom);

Medication.hasMany(HealthRecord);
HealthRecord.belongsTo(Medication);

User.hasMany(Symptom);
Symptom.belongsTo(User);

User.hasMany(Medication);
Medication.belongsTo(User);

// Связь пользователя с анализами
User.hasMany(Analysis);
Analysis.belongsTo(User);

module.exports = {
  User,
  Symptom,
  Medication,
  HealthRecord,
  Analysis,
  Report,
  KpIndex 
};