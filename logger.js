const winston = require('winston'); // winston 모듈 불러오기
const path = require('path'); // path 모듈 불러오기
const {format } = winston;

const logDir = path.join(__dirname, '/logs'); // 로그 디렉터리 설정하기 (__dirname은 현재 파일의 위치를 나타냄)
const { combine, timestamp, printf, colorize, simple } = winston.format; // winston.format에서 필요한 함수들 불러오기
const logFormat = printf(({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`); // 로그 출력 포맷 설정하기

// logger 객체 생성하기
const logger = winston.createLogger({
  format: combine(format.errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat), // 로그의 출력 형식 설정하기
  transports: [ // 로그 저장 방법 설정하기
    new winston.transports.File({ filename: path.join(logDir, '/debug.log'), level: 'debug' }), // debug 레벨의 로그는 info.log 파일에 저장하기
    new winston.transports.File({ filename: path.join(logDir, '/info.log'), level: 'info' }), // info 레벨의 로그는 info.log 파일에 저장하기
    new winston.transports.File({ filename: path.join(logDir, '/error.log'), level: 'error' }), // error 레벨의 로그는 error.log 파일에 저장하기
  ],
});

// NODE_ENV 환경 변수가 'production'이 아닌 경우, 콘솔에도 로그 출력하기
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: combine(colorize(), simple()) })); // 콘솔에 색상을 추가하여 로그 출력하기
}

module.exports = logger; // logger 객체 내보내기
