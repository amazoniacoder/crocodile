/**
 * Seed: топ-50 городов России для модуля погоды
 * Запуск: npx tsx scripts/seed-weather-locations.ts
 */
import '../server/db/db';
import { db } from '../server/db/db';
import { weatherLocations } from '../shared/types/schema';

const CITIES = [
  { name: 'Москва',             nameEn: 'Moscow',           lat: 55.75222,  lon: 37.61556,  tz: 'Europe/Moscow',      sort: 1  },
  { name: 'Санкт-Петербург',    nameEn: 'Saint Petersburg', lat: 59.93900,  lon: 30.31600,  tz: 'Europe/Moscow',      sort: 2  },
  { name: 'Новосибирск',        nameEn: 'Novosibirsk',      lat: 54.99244,  lon: 82.94068,  tz: 'Asia/Novosibirsk',   sort: 3  },
  { name: 'Екатеринбург',       nameEn: 'Yekaterinburg',    lat: 56.83892,  lon: 60.60570,  tz: 'Asia/Yekaterinburg', sort: 4  },
  { name: 'Казань',             nameEn: 'Kazan',            lat: 55.78874,  lon: 49.12214,  tz: 'Europe/Moscow',      sort: 5  },
  { name: 'Нижний Новгород',    nameEn: 'Nizhny Novgorod',  lat: 56.32867,  lon: 44.00205,  tz: 'Europe/Moscow',      sort: 6  },
  { name: 'Челябинск',          nameEn: 'Chelyabinsk',      lat: 55.15402,  lon: 61.42915,  tz: 'Asia/Yekaterinburg', sort: 7  },
  { name: 'Самара',             nameEn: 'Samara',           lat: 53.20007,  lon: 50.15000,  tz: 'Europe/Samara',      sort: 8  },
  { name: 'Омск',               nameEn: 'Omsk',             lat: 54.99244,  lon: 73.36859,  tz: 'Asia/Omsk',          sort: 9  },
  { name: 'Ростов-на-Дону',     nameEn: 'Rostov-on-Don',    lat: 47.22291,  lon: 39.71882,  tz: 'Europe/Moscow',      sort: 10 },
  { name: 'Уфа',                nameEn: 'Ufa',              lat: 54.73480,  lon: 55.95720,  tz: 'Asia/Yekaterinburg', sort: 11 },
  { name: 'Красноярск',         nameEn: 'Krasnoyarsk',      lat: 56.01839,  lon: 92.86717,  tz: 'Asia/Krasnoyarsk',   sort: 12 },
  { name: 'Воронеж',            nameEn: 'Voronezh',         lat: 51.67204,  lon: 39.18430,  tz: 'Europe/Moscow',      sort: 13 },
  { name: 'Пермь',              nameEn: 'Perm',             lat: 58.01046,  lon: 56.25017,  tz: 'Asia/Yekaterinburg', sort: 14 },
  { name: 'Волгоград',          nameEn: 'Volgograd',        lat: 48.71939,  lon: 44.50183,  tz: 'Europe/Volgograd',   sort: 15 },
  { name: 'Краснодар',          nameEn: 'Krasnodar',        lat: 45.04484,  lon: 38.97603,  tz: 'Europe/Moscow',      sort: 16 },
  { name: 'Саратов',            nameEn: 'Saratov',          lat: 51.54056,  lon: 46.00861,  tz: 'Europe/Saratov',     sort: 17 },
  { name: 'Тюмень',             nameEn: 'Tyumen',           lat: 57.15222,  lon: 65.52722,  tz: 'Asia/Yekaterinburg', sort: 18 },
  { name: 'Иркутск',            nameEn: 'Irkutsk',          lat: 52.29778,  lon: 104.29639, tz: 'Asia/Irkutsk',       sort: 19 },
  { name: 'Хабаровск',          nameEn: 'Khabarovsk',       lat: 48.48272,  lon: 135.08379, tz: 'Asia/Vladivostok',   sort: 20 },
  { name: 'Владивосток',        nameEn: 'Vladivostok',      lat: 43.11556,  lon: 131.88222, tz: 'Asia/Vladivostok',   sort: 21 },
  { name: 'Ярославль',          nameEn: 'Yaroslavl',        lat: 57.62987,  lon: 39.87368,  tz: 'Europe/Moscow',      sort: 22 },
  { name: 'Барнаул',            nameEn: 'Barnaul',          lat: 53.34780,  lon: 83.77861,  tz: 'Asia/Barnaul',       sort: 23 },
  { name: 'Томск',              nameEn: 'Tomsk',            lat: 56.49771,  lon: 84.97437,  tz: 'Asia/Tomsk',         sort: 24 },
  { name: 'Оренбург',           nameEn: 'Orenburg',         lat: 51.76806,  lon: 55.09750,  tz: 'Asia/Yekaterinburg', sort: 25 },
  { name: 'Кемерово',           nameEn: 'Kemerovo',         lat: 55.35470,  lon: 86.08778,  tz: 'Asia/Novokuznetsk',  sort: 26 },
  { name: 'Новокузнецк',        nameEn: 'Novokuznetsk',     lat: 53.75667,  lon: 87.11361,  tz: 'Asia/Novokuznetsk',  sort: 27 },
  { name: 'Рязань',             nameEn: 'Ryazan',           lat: 54.62896,  lon: 39.74017,  tz: 'Europe/Moscow',      sort: 28 },
  { name: 'Астрахань',          nameEn: 'Astrakhan',        lat: 46.34968,  lon: 48.04076,  tz: 'Europe/Astrakhan',   sort: 29 },
  { name: 'Пенза',              nameEn: 'Penza',            lat: 53.19572,  lon: 45.01726,  tz: 'Europe/Moscow',      sort: 30 },
  { name: 'Липецк',             nameEn: 'Lipetsk',          lat: 52.60310,  lon: 39.57076,  tz: 'Europe/Moscow',      sort: 31 },
  { name: 'Тула',               nameEn: 'Tula',             lat: 54.19327,  lon: 37.61774,  tz: 'Europe/Moscow',      sort: 32 },
  { name: 'Киров',              nameEn: 'Kirov',            lat: 58.59665,  lon: 49.65390,  tz: 'Europe/Kirov',       sort: 33 },
  { name: 'Чебоксары',          nameEn: 'Cheboksary',       lat: 56.13655,  lon: 47.24774,  tz: 'Europe/Moscow',      sort: 34 },
  { name: 'Калининград',        nameEn: 'Kaliningrad',      lat: 54.70649,  lon: 20.51095,  tz: 'Europe/Kaliningrad', sort: 35 },
  { name: 'Брянск',             nameEn: 'Bryansk',          lat: 53.24341,  lon: 34.36380,  tz: 'Europe/Moscow',      sort: 36 },
  { name: 'Курск',              nameEn: 'Kursk',            lat: 51.73020,  lon: 36.19344,  tz: 'Europe/Moscow',      sort: 37 },
  { name: 'Иваново',            nameEn: 'Ivanovo',          lat: 57.00000,  lon: 40.97389,  tz: 'Europe/Moscow',      sort: 38 },
  { name: 'Магнитогорск',       nameEn: 'Magnitogorsk',     lat: 53.41544,  lon: 59.06210,  tz: 'Asia/Yekaterinburg', sort: 39 },
  { name: 'Тверь',              nameEn: 'Tver',             lat: 56.85901,  lon: 35.90046,  tz: 'Europe/Moscow',      sort: 40 },
  { name: 'Ставрополь',         nameEn: 'Stavropol',        lat: 45.04484,  lon: 41.96960,  tz: 'Europe/Moscow',      sort: 41 },
  { name: 'Белгород',           nameEn: 'Belgorod',         lat: 50.59531,  lon: 36.58778,  tz: 'Europe/Moscow',      sort: 42 },
  { name: 'Сочи',               nameEn: 'Sochi',            lat: 43.60000,  lon: 39.73333,  tz: 'Europe/Moscow',      sort: 43 },
  { name: 'Мурманск',           nameEn: 'Murmansk',         lat: 68.97917,  lon: 33.09251,  tz: 'Europe/Moscow',      sort: 44 },
  { name: 'Якутск',             nameEn: 'Yakutsk',          lat: 62.03389,  lon: 129.73306, tz: 'Asia/Yakutsk',       sort: 45 },
  { name: 'Улан-Удэ',           nameEn: 'Ulan-Ude',         lat: 51.82722,  lon: 107.60639, tz: 'Asia/Irkutsk',       sort: 46 },
  { name: 'Махачкала',          nameEn: 'Makhachkala',      lat: 42.98306,  lon: 47.50444,  tz: 'Europe/Moscow',      sort: 47 },
  { name: 'Владикавказ',        nameEn: 'Vladikavkaz',      lat: 43.02444,  lon: 44.68167,  tz: 'Europe/Moscow',      sort: 48 },
  { name: 'Архангельск',        nameEn: 'Arkhangelsk',      lat: 64.54000,  lon: 40.53583,  tz: 'Europe/Moscow',      sort: 49 },
  { name: 'Петропавловск-Камчатский', nameEn: 'Petropavlovsk-Kamchatsky', lat: 53.01667, lon: 158.65472, tz: 'Asia/Kamchatka', sort: 50 },
];

async function seed() {
  console.log(`Seeding ${CITIES.length} weather locations...`);

  for (const city of CITIES) {
    await db
      .insert(weatherLocations)
      .values({
        name:      city.name,
        nameEn:    city.nameEn,
        country:   'Russia',
        latitude:  String(city.lat),
        longitude: String(city.lon),
        timezone:  city.tz,
        sortOrder: city.sort,
        isActive:  true,
      })
      .onConflictDoNothing();
  }

  console.log('Done.');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
