const sequelize = require('../db');
const { DataTypes } = require('sequelize');

const User = sequelize.define('user', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true },
  birthDate: { type: DataTypes.DATEONLY, allowNull: false },
  password: { type: DataTypes.STRING }
}, {
  getterMethods: {
    // Вычисляем возраст пользователя на основе даты рождения
    age() {
      const birthDate = new Date(this.birthDate);
      const age = new Date().getFullYear() - birthDate.getFullYear();
      const monthDifference = new Date().getMonth() - birthDate.getMonth();
      // Если месяц еще не наступил в текущем году, вычитаем 1 год
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
  // Это поле укажет, является ли симптом предустановленным
  isCustom: { type: DataTypes.BOOLEAN, defaultValue: false}
});

// Модель лекарства
const Medication = sequelize.define('medication', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  // Это поле укажет, является ли лекарство предустановленным
  isCustom: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// Модель записи о симптомах и лекарствах, отмеченных пользователями в календаре симптомов
const HealthRecord = sequelize.define('healthRecord', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  recordDate: { type: DataTypes.DATE, allowNull: false },  
  weight: { type: DataTypes.INTEGER, allowNull: true},
  dosage: { type: DataTypes.STRING, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true }
});

// сгенерированные отчеты по данным пользователей
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

module.exports = {
  User,
  Symptom,
  Medication,
  HealthRecord,
  Report
};





