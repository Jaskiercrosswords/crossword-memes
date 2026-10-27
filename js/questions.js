/*
 * Все вопросы игры. Единственное место, где хранится контент.
 *
 * Вопросы и ответы записаны ровно так, как их прислал автор.
 * Ответы приведены к нижнему регистру, латиница заменена кириллицей.
 *
 * Поля записи:
 *   id              — номер вопроса из авторского списка
 *   question        — формулировка для игрока
 *   answer          — ответ в человеческом написании
 *   acceptedAnswers — допустимые варианты (регистр, ё/е и пробелы
 *                     нормализуются автоматически)
 *   note            — внутреннее примечание, игроку не показывается
 *   specialHint     — необязательная особая подсказка-плашка
 */
(function (global) {
  'use strict';

  const QUESTIONS = [
    { id: 1, question: 'Неловко, стыдно', answer: 'кринж', acceptedAnswers: ['кринж'], note: '' },
    { id: 2, question: 'Человек, живущий по шаблону', answer: 'нпс', acceptedAnswers: ['нпс', 'NPC'], note: '' },
    { id: 3, question: 'Игра песочница с открытым миром', answer: 'майнкрафт', acceptedAnswers: ['майнкрафт', 'Minecraft'], note: '' },
    { id: 4, question: 'Платформа номер 1 для стримов игр', answer: 'твич', acceptedAnswers: ['твич', 'Twitch'], note: '' },
    { id: 5, question: 'Персонаж, который спасает принцессу в игре Mario', answer: 'луиджи', acceptedAnswers: ['луиджи', 'Luigi'], note: '' },
    { id: 6, question: 'Игровая консоль от сони', answer: 'плейстейшен', acceptedAnswers: ['плейстейшен', 'PlayStation'], note: '' },
    { id: 7, question: 'Группа, исполнившая песню "богемская рапсодия"', answer: 'квин', acceptedAnswers: ['квин', 'Queen'], note: '' },
    { id: 8, question: 'Популярный мужской персонаж из серии игр резидент ивел', answer: 'леон кеннеди', acceptedAnswers: ['леон кеннеди', 'леон'], note: '' },
    { id: 9, question: 'Актер сыгравший капитана Джека воробья', answer: 'джонни депп', acceptedAnswers: ['джонни депп', 'Johnny Depp'], note: '' },
    { id: 10, question: 'Расслабляться', answer: 'чилить', acceptedAnswers: ['чилить'], note: '', specialHint: 'от английского chill out' },
    { id: 11, question: 'Популярный сериал от HBO про анти супергероев', answer: 'пацаны', acceptedAnswers: ['пацаны', 'The Boys'], note: '' },
    { id: 12, question: '20.31 прибыл', answer: 'годжо сатору', acceptedAnswers: ['годжо сатору', 'годжо'], note: '', specialHint: 'один из героев аниме Магическая Битва' },
    { id: 13, question: 'Российский "брат" ютуба', answer: 'рутуб', acceptedAnswers: ['рутуб', 'Rutube'], note: '' },
    { id: 14, question: 'Что производил Главный герой в фильме бойцовский клуб?', answer: 'мыло', acceptedAnswers: ['мыло'], note: '' },
    { id: 15, question: 'Дьявол носит', answer: 'прада', acceptedAnswers: ['прада', 'Prada'], note: '', specialHint: 'название фильма' },
    { id: 16, question: 'Американский анимационный ситком про семью, где все персонажи желтые', answer: 'симпсоны', acceptedAnswers: ['симпсоны', 'The Simpsons'], note: '' },
    { id: 17, question: 'Популярный мем "это фиаско,.. "', answer: 'братан', acceptedAnswers: ['братан'], note: '' },
    { id: 18, question: 'Дружелюбный сосед', answer: 'человек паук', acceptedAnswers: ['человек паук', 'человек-паук', 'спайдермен', 'Spider-Man'], note: '' },
    { id: 19, question: 'Гений, миллиардер, плейбой, филантроп', answer: 'тони старк', acceptedAnswers: ['тони старк', 'тони'], note: '' },
    { id: 20, question: 'Плоский игровой пульт для хбокс или плойки', answer: 'геймпад', acceptedAnswers: ['геймпад', 'контроллер'], note: '' },
    { id: 21, question: 'Любят пиццу и живут в канализации', answer: 'черепашки ниндзя', acceptedAnswers: ['черепашки ниндзя', 'черепашки-ниндзя', 'TMNT'], note: 'Длинный ответ (15 букв) не помещается в сетку и выводится в блоке дополнительных слов.' },
    { id: 22, question: 'Популярная соц сеть среди подростков в 2016-2020 годах', answer: 'вконтакте', acceptedAnswers: ['вконтакте', 'вк', 'VK'], note: '' },
    { id: 23, question: 'Мультсериал 2000х про фей', answer: 'винкс', acceptedAnswers: ['винкс', 'Winx'], note: '' },
    { id: 24, question: 'Машина дина винчестера из сериала сверхъестественное', answer: 'импала', acceptedAnswers: ['импала', 'Impala'], note: '' },
    { id: 25, question: 'Японская анимация', answer: 'аниме', acceptedAnswers: ['аниме'], note: '' },
    { id: 26, question: 'Смешной формат с коротким текстом', answer: 'мем', acceptedAnswers: ['мем'], note: '' },
    { id: 27, question: 'Популярный жанр японских комиксов', answer: 'манга', acceptedAnswers: ['манга'], note: '' },
    { id: 28, question: 'Серия фильмов или игр с продолжением', answer: 'франшиза', acceptedAnswers: ['франшиза'], note: '' },
    { id: 29, question: 'Музыкальный ролик с нарезками', answer: 'эдит', acceptedAnswers: ['эдит'], note: '' },
    { id: 30, question: 'Главный герой', answer: 'протагонист', acceptedAnswers: ['протагонист'], note: '' },
    { id: 31, question: 'Тот кто противостоит главному герою', answer: 'антагонист', acceptedAnswers: ['антагонист'], note: '' },
    { id: 32, question: 'Культовый сайт с различными видео', answer: 'ютуб', acceptedAnswers: ['ютуб', 'ютьюб', 'YouTube'], note: '' },
    { id: 33, question: 'Популярный жанр страшных историй', answer: 'хоррор', acceptedAnswers: ['хоррор', 'ужасы'], note: '' },
    { id: 34, question: 'Космическая сага с джедаями', answer: 'звёздные войны', acceptedAnswers: ['звёздные войны', 'звездные войны', 'Star Wars'], note: '' },
    { id: 35, question: 'Культовая Вселенная про супергероев', answer: 'марвел', acceptedAnswers: ['марвел', 'Marvel'], note: '' },
    { id: 36, question: 'Домашний длительный просмотр без выхода в кинотеатр', answer: 'киномарафон', acceptedAnswers: ['киномарафон'], note: '' },
    { id: 37, question: 'Голосовой перевод фильма', answer: 'озвучка', acceptedAnswers: ['озвучка', 'дубляж'], note: '' },
    { id: 38, question: 'Обьект симпатии', answer: 'краш', acceptedAnswers: ['краш', 'crush'], note: '' },
    { id: 39, question: 'Популярный жанр в кино, в основе которого лежит история зарождения любви', answer: 'ромком', acceptedAnswers: ['ромком', 'romcom'], note: '' },
    { id: 40, question: 'Костюмированная культура фанатов', answer: 'косплей', acceptedAnswers: ['косплей', 'cosplay'], note: '' },
    { id: 41, question: 'Короткое название фанатского сообщества', answer: 'фандом', acceptedAnswers: ['фандом', 'fandom'], note: '' },
    { id: 42, question: 'Сильное преувеличение ради шутки', answer: 'абсурд', acceptedAnswers: ['абсурд', 'гипербола'], note: '' },
    { id: 43, question: 'Смешной, но уже заезженный мем', answer: 'баян', acceptedAnswers: ['баян', 'боян'], note: '' },
    { id: 44, question: 'Тот, кто пишет одни гадости', answer: 'хейтер', acceptedAnswers: ['хейтер', 'hater'], note: '' },
    { id: 45, question: 'Набор слов и выражений, которые употребляются в разговорной речи определенными группами', answer: 'сленг', acceptedAnswers: ['сленг', 'слэнг'], note: '' },
    { id: 46, question: 'Подробности по вселенной', answer: 'лор', acceptedAnswers: ['лор', 'lore'], note: '' },
    { id: 47, question: 'Тот, кто намеренно бесит людей в сети', answer: 'тролль', acceptedAnswers: ['тролль', 'troll'], note: '' },
    { id: 48, question: 'Завязка, после которой уже нельзя оторваться от просмотра', answer: 'интрига', acceptedAnswers: ['интрига'], note: '' },
    { id: 49, question: 'Стыд по-....', answer: 'испански', acceptedAnswers: ['испански'], note: 'Написание сохранено как в авторском списке.' },
    { id: 50, question: 'Состояние, когда человек идет к своей цели несмотря ни на что', answer: 'воля', acceptedAnswers: ['воля'], note: '' },
    { id: 51, question: 'Бог грома в скандинавской мифологии', answer: 'тор', acceptedAnswers: ['тор', 'Thor'], note: '' },
    { id: 52, question: 'Старинное сказание о героях и богах', answer: 'миф', acceptedAnswers: ['миф'], note: '' },
    { id: 53, question: 'Литературный приём- противопоставления', answer: 'антитеза', acceptedAnswers: ['антитеза'], note: '' },
    { id: 54, question: 'Герой, выражающий чувства автора', answer: 'лирический', acceptedAnswers: ['лирический'], note: '' },
    { id: 55, question: 'Студия, создавшая "унесённые призраками"', answer: 'гибли', acceptedAnswers: ['гибли', 'Ghibli'], note: '' },
    { id: 56, question: 'Фильм о мальчике волшебнике с молнией на лбу', answer: 'гарри поттер', acceptedAnswers: ['гарри поттер', 'гарри', 'Harry Potter'], note: '' },
    { id: 57, question: 'Антиутопия Джорджа Оруэлла', answer: '1984', acceptedAnswers: ['1984'], note: 'Ответ-число: в сетке набираются цифры.' },
    { id: 58, question: 'Многосерийный фильм с продолжением', answer: 'сериал', acceptedAnswers: ['сериал'], note: '' },
    { id: 59, question: 'Литературный образ идеального мира', answer: 'утопия', acceptedAnswers: ['утопия'], note: '' },
    { id: 60, question: 'Древнее предание', answer: 'легенда', acceptedAnswers: ['легенда'], note: '' },
    { id: 61, question: 'Анимационный сериал с чёрным юмором', answer: 'южный парк', acceptedAnswers: ['южный парк', 'South Park'], note: '' },
    { id: 62, question: 'Сериал ... «история ужасов»', answer: 'американская', acceptedAnswers: ['американская'], note: '' },
    { id: 63, question: 'Всемирная пандемия в 2020', answer: 'ковид', acceptedAnswers: ['ковид', 'COVID', 'коронавирус'], note: '' },
    { id: 64, question: 'Онлайн учеба', answer: 'дистант', acceptedAnswers: ['дистант', 'дистанционка'], note: '' },
    { id: 65, question: 'Популярная соц сеть для публикации и просмотра фото', answer: 'инстаграм', acceptedAnswers: ['инстаграм', 'Instagram'], note: '' },
    { id: 66, question: 'Первая массовая криптовалюта', answer: 'биткоин', acceptedAnswers: ['биткоин', 'биткойн', 'Bitcoin'], note: '' },
    { id: 67, question: 'Онлайн-покупки вместо магазинов', answer: 'маркетплейс', acceptedAnswers: ['маркетплейс'], note: '' },
    { id: 68, question: 'Массовые интернет-флешмобы', answer: 'челлендж', acceptedAnswers: ['челлендж', 'challenge'], note: '' },
    { id: 70, question: 'Массовая травля в сети', answer: 'кибербуллинг', acceptedAnswers: ['кибербуллинг', 'cyberbullying'], note: '' },
    { id: 71, question: 'Поп группа с хитом "18 мне уже"', answer: 'руки вверх', acceptedAnswers: ['руки вверх', 'Руки Вверх'], note: '' },
    { id: 72, question: 'Группа, ставшая культовой среди подростков в 2010-х годов', answer: 'пошлая молли', acceptedAnswers: ['пошлая молли'], note: '', specialHint: 'написали песни Нон-Стоп и Контракт' },
    { id: 73, question: 'Рэпер, задавший новую волну баттл-культуры', answer: 'оксимирон', acceptedAnswers: ['оксимирон', 'Oxxxymiron'], note: '' },
    { id: 74, question: 'Лидер группы «Кино»', answer: 'цой', acceptedAnswers: ['цой', 'виктор цой'], note: '' },
    { id: 75, question: 'Культовый сериал про выживание в зомби апокалипсиса', answer: 'ходячие мертвецы', acceptedAnswers: ['ходячие мертвецы', 'The Walking Dead'], note: 'Длинный ответ (15 букв) не помещается в сетку и выводится в блоке дополнительных слов.' },
    { id: 76, question: 'Самое длинное аниме о поиске величайшего сокровища', answer: 'ван пис', acceptedAnswers: ['ван пис', 'ванпис', 'One Piece'], note: '' },
    { id: 77, question: 'Аниме, научившее весь мир бегать с руками назад', answer: 'наруто', acceptedAnswers: ['наруто', 'Naruto'], note: '' },
    { id: 78, question: '"Смотри, туман прямо как в ......"', answer: 'сайллент хилл', acceptedAnswers: ['сайллент хилл', 'сайлент хилл', 'Silent Hill'], note: '', specialHint: 'популярная игра' },
    { id: 79, question: 'Самый популярный зарубежный ситком', answer: 'друзья', acceptedAnswers: ['друзья', 'Friends'], note: '' },
    { id: 80, question: 'Российский ситком о непрекращающейся студенческой жизни', answer: 'универ', acceptedAnswers: ['универ'], note: '' },
    {
      id: 81,
      question: 'Дуэт "розового" "и "ядерного" фильмов в 2023 году',
      answer: 'барбигеймер',
      acceptedAnswers: ['барбигеймер'],
      note: '',
      specialHint: 'в 2023 году на свет одновременно вышли два совершенно разных фильма ставшие кассовым противостоянием, люди приходили на показы в сочетании розового и черного'
    },
    { id: 82, question: 'Первое место среди классических писателей известных по всему миру', answer: 'достоевский', acceptedAnswers: ['достоевский'], note: '' },
    { id: 83, question: 'Командная многопользовательская компьютерная игра в жанре MODA', answer: 'дота', acceptedAnswers: ['дота', 'Dota'], note: '' },
    { id: 84, question: 'Российская замена макдональдс', answer: 'вкусно и точка', acceptedAnswers: ['вкусно и точка', 'вкусноиточка'], note: '' },
    { id: 85, question: 'Культовый хоррор с Призрачным Лицом', answer: 'крик', acceptedAnswers: ['крик', 'Scream'], note: '' },
    { id: 86, question: 'Популярный корейский сериал про игры на выживание', answer: 'игра в кальмара', acceptedAnswers: ['игра в кальмара', 'игравкальмара'], note: '' },
    { id: 87, question: 'Точка зрения, с которой начинается 90% текстовых мемов в Тиктоке', answer: 'пов', acceptedAnswers: ['пов', 'pov'], note: '' },
    { id: 88, question: 'Зелёный порошковый чай', answer: 'матча', acceptedAnswers: ['матча', 'matcha'], note: '' },
    { id: 89, question: 'всемирно известная визуальная соцсеть и поисковик, где пользователи ищут, сохраняют и делятся идеями для вдохновения', answer: 'пинтерест', acceptedAnswers: ['пинтерест', 'Pinterest'], note: '' },
    { id: 90, question: 'Повторная публикация чужого поста', answer: 'репост', acceptedAnswers: ['репост', 'repost'], note: '' },
    { id: 91, question: 'Крипипаста в жанре лиминальных пространств', answer: 'закулисье', acceptedAnswers: ['закулисье'], note: '' },
    { id: 92, question: 'Поджанр художественной литературы где любовная линия развивается на фоне опасности', answer: 'даркроман', acceptedAnswers: ['даркроман', 'dark romance'], note: '' },
    { id: 93, question: 'Популярный мем "давай по новой, ......, все х*йня"', answer: 'миша', acceptedAnswers: ['миша'], note: '' },
    { id: 94, question: 'Настольный детектив, в котором город засыпает, а просыпаются убийцы', answer: 'мафия', acceptedAnswers: ['мафия'], note: '' }
  ];

  global.QUESTIONS = QUESTIONS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QUESTIONS;
  }
})(typeof window !== 'undefined' ? window : globalThis);
