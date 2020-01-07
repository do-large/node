//로그인 인증 함수

module.exports= function(id, password) {
   return new Promise(function(resolve, reject){
      pool.getConnection(function(err, conn) {
         if (err) {
            if (conn) {
                 conn.release();  // 반드시 해제해야 함
             }
             callback(err, null);
             return;
         }   
         console.log('데이터베이스 연결 스레드 아이디 : ' + conn.threadId);
           
       // SQL 문을 실행합니다.
      conn.query("select * from person where id = ?", [id], function(err, rows) {

         if(!rows[0]){
            reject('일치하는 아이디가 없습니다.');
         }
         else{
            crypto.randomBytes(64, (err, buf) => {
               console.dir(rows);
               crypto.pbkdf2(password, rows[0].salt, 100000, 64, 'sha512', (err, key) => {
                  
                  if(err){
                     reject('error 발생');
                  }
  
                  if(key.toString('base64')==rows[0].password)
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

