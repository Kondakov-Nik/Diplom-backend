const axios = require('axios');
const ApiError = require('../error/ApiError');
const { KpIndex } = require('../models/models');
const { Op } = require('sequelize');

class KpController {
  // Получить данные KP-индекса за диапазон дат (существующий метод)
  getKpIndex = async (req, res, next) => {
    const { start, end } = req.query;

    if (!start || !end) {
      return next(ApiError.badRequest('Необходимо указать start и end даты'));
    }

    try {
      let kpData = await KpIndex.findAll({
        where: {
          date: {
            [Op.between]: [start, end]
          }
        },
        attributes: ['date', 'kpIndex']
      });

      const missingDates = [];
      const startDate = new Date(start);
      const endDate = new Date(end);
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (!kpData.find(row => row.date === dateStr)) {
          missingDates.push(dateStr);
        }
      }

      if (missingDates.length > 0) {
        const newData = await this.fetchKpIndexFromNOAA(start, end);
        if (newData.length > 0) {
          for (const { date, kpIndex } of newData) {
            const roundedKpIndex = Math.round(kpIndex);
            await KpIndex.upsert({ date, kpIndex: roundedKpIndex });
          }
          kpData = await KpIndex.findAll({
            where: {
              date: {
                [Op.between]: [start, end]
              }
            },
            attributes: ['date', 'kpIndex']
          });
        } else {
          console.warn(`Данные за диапазон ${start} - ${end} не найдены в NOAA`);
        }
      }

      const roundedKpData = kpData.map(item => ({
        date: item.date,
        kpIndex: Math.round(item.kpIndex)
      }));

      return res.json(roundedKpData);
    } catch (error) {
      next(ApiError.internal(error.message));
    }
  };

  // Новый метод: Получить прогноз KP-индекса на 27 дней вперед
  getKpIndexForecast = async (req, res, next) => {
    try {
      const today = new Date(); // Текущая дата (например, 2025-03-19)
      today.setHours(0, 0, 0, 0); // Сбрасываем время для корректного сравнения

      // Определяем диапазон: с текущей даты на 25 дней вперед
      const daysAhead = 25;
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + daysAhead);

      const start = today.toISOString().split('T')[0]; // Например, "2025-03-19"
      const end = endDate.toISOString().split('T')[0]; // Например, "2025-04-15"

      // Получаем прогнозные данные из 27-day-outlook.txt
      const forecastData = await this.fetchKpIndexForecast(start, end);

      // Создаем массив всех дат в диапазоне
      const dateRange = [];
      for (let d = new Date(today); d <= endDate; d.setDate(d.getDate() + 1)) {
        dateRange.push(d.toISOString().split('T')[0]);
      }

      // Заполняем недостающие даты заглушками (null)
      const result = dateRange.map(date => {
        const forecastEntry = forecastData.find(item => item.date === date);
        return {
          date,
          kpIndex: forecastEntry ? forecastEntry.kpIndex : null
        };
      });

      return res.json(result);
    } catch (error) {
      next(ApiError.internal(error.message));
    }
  };

  // Функция загрузки исторических данных с NOAA (daily-geomagnetic-indices.txt)
  fetchKpIndexFromNOAA = async (start, end) => {
    try {
      const response = await axios.get('https://services.swpc.noaa.gov/text/daily-geomagnetic-indices.txt');
      const lines = response.data.split('\n');
      const kpData = [];

      let dataSection = false;
      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('#') || line.startsWith(':')) {
          if (line.toLowerCase().includes('date')) {
            dataSection = true;
          }
          continue;
        }
        if (dataSection && line.match(/^\d{4}\s+\d{2}\s+\d{2}/)) {
          const parts = line.split(/\s+/).filter(Boolean);
          if (parts.length < 27) {
            continue;
          }
          const year = parts[0];
          const month = parts[1].padStart(2, '0');
          const day = parts[2].padStart(2, '0');
          const date = `${year}-${month}-${day}`;
          if (date >= start && date <= end) {
            const planetaryKIndices = parts.slice(22, 30);
            const kpValues = planetaryKIndices.map(v => parseFloat(v)).filter(v => !isNaN(v) && v >= 0);
            if (kpValues.length === 8) {
              const avgKpIndex = kpValues.reduce((sum, val) => sum + val, 0) / kpValues.length;
              const roundedKpIndex = Math.round(avgKpIndex);
              kpData.push({ date, kpIndex: roundedKpIndex });
            } else {
            }
          }
        }
      }
      return kpData;
    } catch (error) {
      console.error('Ошибка при запросе к NOAA:', error.message);
      return [];
    }
  };

  fetchKpIndexForecast = async (start, end) => {
    try {
      const response = await axios.get('https://services.swpc.noaa.gov/text/27-day-outlook.txt');
      const lines = response.data.split('\n');
      const forecastData = [];
  
      // Карта для преобразования названий месяцев в числа
      const monthMap = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
        'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
  
      let dataSection = false;
      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('#') || line.startsWith(':')) {
          if (line.includes('UTC')) {
            dataSection = true;
          }
          continue;
        }
        // Проверяем строки с датой в формате "YYYY Mon DD"
        if (dataSection && line.match(/^\d{4}\s+[A-Za-z]{3}\s+\d{2}/)) {
          const parts = line.split(/\s+/).filter(Boolean);
          if (parts.length < 6) {
            console.warn('Invalid forecast line format, skipping:', line);
            continue;
          }
          const year = parts[0];
          const monthStr = parts[1];
          const month = monthMap[monthStr];
          if (!month) {
            console.warn('Invalid month format:', monthStr);
            continue;
          }
          const day = parts[2].padStart(2, '0');
          const date = `${year}-${month}-${day}`;
          if (date >= start && date <= end) {
            const kpIndex = parseInt(parts[5]); 
            if (!isNaN(kpIndex)) {
              forecastData.push({ date, kpIndex });
            } else {
              console.warn('Invalid Kp Index for date', date, ':', parts[5]);
            }
          }
        }
      }
      return forecastData;
    } catch (error) {
      console.error('Ошибка при запросе прогноза к NOAA:', error.message);
      return [];
    }
  };
}

module.exports = new KpController();