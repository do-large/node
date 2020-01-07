var express = require('express')
  , https = require('https')
  , path = require('path')
  , fs = require('fs');

var bodyParser = require('body-parser')
  , static = require('serve-static')
  , errorHandler = require('errorhandler')
  , session = require('express-session')
  ,MySQLStore = require('express-mysql-session')(session),
  crypto = require('crypto');
var passport = require('passport')
   , localStrategy=require('passport-local').Strategy, 
    FacebookStrategy = require('passport-facebook').Strategy;

const app = express();

app.set('port', process.env.PORT || 5000);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var expressErrorHandler = require('express-error-handler');

//===== MySQL 데이터베이스를 사용할 수 있도록 하는 mysql 모듈 불러오기 =====//
var mysql = require('mysql');

//===== MySQL 데이터베이스 연결 설정 =====//
var pool = mysql.createPool({
   connectionLimit : 10,
   //connectTimeout  : 60 * 60 * 10000,
    //acquireTimeout  : 60 * 60 * 10000,
   //timeout         : 60 * 60 * 10000,
   acquireTimeout: 30000,
    host     : 'localhost',
    user     : 'root',
    password : '5872',
    database : 'test',
    port    :  null,
    debug   :  false
});

app.use(passport.initialize());
app.use(passport.session());

app.use(session({
    secret : '1234',
    store : new MySQLStore(pool),
    resave: false,
    saveUninitialized : false
 }));

var router = express.Router();
app.use('/', router);

router.route('/api/hello').post(function(req, res){
    if(req.body.name == 'hello')
        res.send(true);
      else
          res.send(false);
 });

router.route('/api/login_success').post(function(req, res){
console.log('여기루')
res.send('success');

 });

 router.route('/api/login_fail').post(function(req, res){
 console.log('fail')
 res.send(false)
 });

 router.route('/auth/login').post(passport.authenticate('local'), (req, res) => {
    console.log('session 저장 완료')
    console.log(req.session.passport.user.id)
    res.send(true)
 });
 
passport.use(new localStrategy({
    usernameField : 'name',
    passwordField :'password',
    passReqToCallback : false,
    session:true
  }
  , function(name, password){
    if (pool) {
       console.log('pool 객체 생성');
      authUser(name, password)
      .then((result)=>{
         console.log('결과있음');
         console.dir(result);
        return result;
       })
       .catch((error) =>{
         console.log(error);
         console.log('실패')
         return false;
       });
   }else{
        console.log('pool error')
        return false;
    }
 }));

  passport.serializeUser(function(user, done) {
    console.log('serialize');
    done(null, user);
 });
 
 passport.deserializeUser(function(user, done) {
    console.log('deserialize');
    done(null, user);
 });

 // 페이스북 패스포트
 passport.use(new FacebookStrategy({
   clientID: '803463163429092',
   clientSecret: '076e59625b759240c03aeac77615223f',
   callbackURL: "https://localhost:5000/auth/facebook/callback"//여기꺼가 진짜임
 },(accessToken, refreshToken, profile, done) => {
   console.log('페이스북 접속 성공 '+ accessToken, refreshToken, profile);
 }));

app.get('/auth/facebook', passport.authenticate('facebook', {
  scope : 'email'
}));

app.get('/auth/facebook/callback', passport.authenticate('facebook', 
{ successMessage: 'hihi',
  failureMessage: 'nnn' }));

//-----------------------------------------------------------------------------------------------
// 사용자 추가 라우팅
router.route('/api/adduser').post(function(req, res) {
   console.log('/api/adduser 호출됨.');

    var paramUserName = req.body.userName || req.query.userName;
    var paramPassword = req.body.password || req.query.password;
    var paramName = req.body.name || req.query.name;
    var phoneNum = req.body.phoneNum || req.query.phoneNum;

    // pool 객체가 초기화된 경우, addUser 함수 호출하여 사용자 추가
   if (pool) {
      addUser(paramUserName, paramPassword, paramName, phoneNum)
      .then((addedUser)=> {
         // 동일한 id로 추가하려는 경우 에러 발생 - 클라이언트로 에러 전송
            console.dir(addedUser);
            console.log('inserted ' + addedUser.affectedRows + ' rows');
            return res.send('성공성공');
      })
      .catch((error)=> {
         console.log(error);
         return res.send('에러발새우ㅜㅜ');
      });
   } else {  // 데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
      return res.send('db에 연결도 안됨');
   }
});

//--------------------------------------------------------------------------------------------------
//로그인 인증 함수
var authUser = function(id, password) {
    return new Promise(function(resolve, reject) {
       console.log('authUser함수 호출됨' + id+','+password);
       pool.getConnection( function(err, conn) {
         console.log('이것은 conn이랑깨' + conn);
          if (err) {
             if (conn) {
                  console.log('인증함수 내에서 에러발생');
                  conn.release();  // 반드시 해제해야 함
              }
              reject();
          }
        
        // SQL 문을 실행합니다.
        console.log(pool);
        
        conn.query("SELECT * FROM users where phone = ?", [id], (err, rows) => {
        
          if(!rows[0]) {
             reject('일치하는 아이디가 없습니다.');
          } else {
            console.dir(rows);
             crypto.randomBytes(64, (err, buf) => {
                crypto.pbkdf2(password, rows[0].salt, 100000, 64, 'sha512', (err, key) => {
                   if(err){
                      reject('error 발생');
                   }
                   console.log(rows[0].pwd);
                   console.log(key.toString('base64').substring(0,20));
                   if(key.toString('base64').substring(0,20)==rows[0].pwd)
                     resolve(rows[0]);
                   else
                      reject('비밀번호가 일치하지 않습니다.');
                  });
             });//crypto
          }
      });
     });
    });
 };

 //사용자를 등록하는 함수
 var addUser = function(id, password, name, phoneNum) {
   return new Promise(function(resolve, reject){  
   console.log('addUser 호출됨 : ' + id + ', ' + password + ', ' + name+','+phoneNum);
   pool.getConnection((err, conn) => {
      if (err) {
         if (conn) {
              conn.release(); 
          }
          reject();
      }
     // console.log('데이터베이스 연결 스레드 아이디 : ' + conn.threadId);
            crypto.randomBytes(64, (err, buf) => {
               crypto.pbkdf2(password, buf.toString('base64'), 100000, 64, 'sha512', (err, key) => {
                  var data = {id:id, pwd:key.toString('base64'), salt:buf.toString('base64'), name:name, phone:phoneNum};
                  conn.query('insert into users(id, pwd, salt, name, phone) values (?, ?, ?, ?, ?)',
                  [id, key.toString('base64'), buf.toString('base64'),name, phoneNum], (err, result) => {
                     console.log(result);
                     conn.release(); 
                     if(err){
                        reject();
                     } else{
                     resolve(result);
                     }
               })
                  //[id, key.toString('base64'), buf.toString('base64'), name, phoneNum], (err, result)=>{
                     
                  });                  
            })
         })
      });
   };

// 404 에러 페이지 처리
var errorHandler = expressErrorHandler({
    static: {
      '404': 'public/404.html'
    }
   });
   
   app.use( expressErrorHandler.httpError(404) );
   app.use( errorHandler );
   
 const option= {
    key: fs.readFileSync('./key/key.pem', 'utf8'),
    cert:fs.readFileSync('./key/server.crt', 'utf8')
 };
 // Express 서버 시작
 https.createServer(option, app).listen(app.get('port'), function(){
   console.log('서버가 시작되었습니다. 포트 : ' + app.get('port'));
 });
