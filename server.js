const express = require("express");
const mysql = require('mysql');
const app = express();
const axios = require("axios");
const cors = require('cors');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const multer = require("multer");
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const bodyParser = require('body-parser');
const crypto = require('crypto'); // Node.js 내장 모듈이며, 여러 해시 함수를 통한 암호화 기능을 제공
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const fs = require('fs');
app.use(cors());


// aws 연동
const s3 = new aws.S3({
  region: 'ap-northeast-2',
  accessKeyId: "---",
  secretAccessKey: "---"
});

// sql 연동
const db = mysql.createConnection({
  user: 'people',
  host: '---',
  password: '---',
  database: 'people'
});

// db가잘 연동 되었는지 확인
db.connect(function(err) { 
  if(err) throw err;
  console.log('DB is Connected!')
});


app.listen(3001, function() {
  console.log("Server is running");
});


//S3연동
const storage = multerS3({
  s3: s3,
  bucket: 'sodam-s3', // 자신의 s3 버킷 이름
  contentType: multerS3.AUTO_CONTENT_TYPE,
  acl: 'public-read', // 읽기만 가능, 쓰기 불가능
  metadata: function(req, file, cb) {
      cb(null, {fieldName: file.fieldname});
  },
  key: function (req, file, cb) { // 객체의 키로 고유한 식별자 이기 때문에 겹치면 안됨
      cb(null, `contents/${Date.now()}_${file.originalname}`);
  }
})


const upload = multer({
  storage: storage // storage를 multerS3 객체로 지정
})






// s3에 업로드
app.post('/upload', upload.single('image'), (req, res) => {
  console.log("일단 옴");
  res.send(req.file.location);
  console.log(req.file.location);
})


//이메일 인증번호
app.post('/checkNum', (req, res) => {
  console.log("오긴 옴")
  let id = req.query.id;
  let email = req.query.email;
  const randomBytes = require("crypto").randomBytes(3);
  const number = parseInt(randomBytes.toString("hex"), 16); // 인증번호 생성

  let values = [id, email]
  const sql = "Select email From userInfo Where id = ? AND email = ?";

  db.query(sql, values,(err, result) => {
    if(err){
      console.log(err);
    }
    if(result.length > 0) {
      console.log("계정 존재");
      console.log(number);
      axios({
        method: "POST",
        url: "https://api.emailjs.com/api/v1.0/email/send",
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          service_id: "---",
          template_id: "---",
          user_id: "---",
          accessToken: "---",
          template_params: {
            email: email,
            checkNum: number,
          },
        },
      })
      .then((result) => {
        console.log(number);
        res.send({result:number});
      })
      .catch(function(error) {
        console.log(error)
      })

    }else{
      console.log("계정이 존재하지 않음")
      res.send('1');
    }
    });
});


//인증 성공 시 비밀번호 변경
app.post('/Reset', (req, res) => {
  let id = req.query.id;
  let pw = crypto.createHash("sha512").update(req.query.pw).digest("base64");
  let values = [pw, id]
  
  console.log(values);

  const sql = "UPDATE userInfo SET pw = ? Where id = ?";
  db.query(sql, values,
    (err, result) => {
     
     console.log(result)
        if (err)
            console.log(err);
        else{
          console.log(result);
          res.send(result);
        }
        
    });

})


//회원가입
app.post('/register', (req, res) => {
  //파라미터를 받아오는 부분
  let id = req.query.id;
  let email = req.query.email;
  let pw = crypto.createHash("sha512").update(req.query.pw).digest("base64");
  let values = [id, email, pw]

  console.log(values)
  
  //SQL 코드
  const sql = "INSERT INTO userInfo(id, email, pw) VALUES(?, ?, ?)"
  db.query(sql, values,
      (err, result) => {
          if (err)
              console.log(err);
          else
              res.send(result);
      });
});

//로그인
app.post('/login', (req, res) => {
  let id = req.query.id;
  let pw = crypto.createHash("sha512").update(req.query.pw).digest("base64");

  let values = [id, pw]

  console.log(values);

  const sql = "select id From userInfo Where id = ? AND pw = ?"
  db.query(sql, values,
    
    (err, result) => {
      
        if (err)
            console.log(err);
        if(result.length > 0) {
          console.log("로그인 성공");
          res.send('0'); // 로그인에 성공하면 0을, 실패하면 1을 반환
          console.log(result) 
        }else {
          res.send('1');
          console.log("로그인 실패");
        }
    });
});


//아이디 중복 체크
app.post('/overlap', function(req, res) {
  let id = req.query.id;
  let values = [id]

  // console.log(values)
  //SQL 코드
  const sql = "Select * From userInfo WHERE id = ?"
  db.query(sql, values,
    
      (err, result) => {
          if (err)
              console.log(err);
          if(result.length < 1) {
            console.log("없는 아이디");
            res.send('0'); // 중복검사에 성공하면 0을, 실패하면 1을 반환
          }else {
            res.send('1');
            console.log("있는 아이디");
            console.log(result)
          }
      });
});


//글 작성
app.post('/write', async function(req, res) {
  console.log("일단 옴");
  let id = req.query.id;
  let title = req.query.title;
  let content = req.query.content;
  let year = req.query.year;
  let month = req.query.month;
  let day = req.query.day;
  let img = req.query.img;
  let voice = req.query.voice;
  let keyword = req.query.keyword;

  let emotion;
  let positive;
  let negative;
  let neutral;

  //텍스트 감정분석 api
  await axios({
    method: "POST",
    url: "https://naveropenapi.apigw.ntruss.com/sentiment-analysis/v1/analyze",
    headers: {
      "X-NCP-APIGW-API-KEY-ID": "---",
      "X-NCP-APIGW-API-KEY": "---",
      "Content-Type": "application/json",
    },
    data: {
      content: content,
    },
  })
  .then((r) => {
    console.log("nice!!",r.data.document);
    emotion = r.data.document.sentiment;
    console.log("감정: ",r.data.document);
    positive = (r.data.document.confidence.positive).toFixed(1);
    negative = (r.data.document.confidence.negative).toFixed(1);
    neutral = (r.data.document.confidence.neutral).toFixed(1);
    // res.send(r.data.document);
  })
  .catch(function (err) {  
    console.log("hey,,,",err);

    if(res.status(400)) { // 에러코드 400이라면
      res.status(400).json({message: err.message})
    } else if(res.status(500)){  // 에러코드 500이라면
      res.status(500).json({message: err.message})
    }
  });


  let values = [id, title, content, year, month, day, img, voice, keyword, emotion, positive, negative, neutral]
  console.log(values);
  // console.log(values)
  //SQL 코드
  const sql = "INSERT INTO diary(id, title, content, year, month, day, img, voice, keyword, emotion, positive, negative, neutral) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  db.query(sql, values,
    (err, result) => {
        if (err)
            console.log(err);
        else
            res.send(result);
    });
});

//얼굴 감정분석 api
// app.post("/face", (req, res) => {
//   console.log("일단 오긴 함");
//   let image = req.files;
//   let path = image.image.path;
//   let image2 = fs.createReadStream(path);
//   console.log(image);
//   axios({
//     method: "POST",
//     url: "https://naveropenapi.apigw.ntruss.com/vision/v1/face",
//     headers: {
//       "X-NCP-APIGW-API-KEY-ID": "---",
//       "X-NCP-APIGW-API-KEY": "---",
//       "Content-Type": "multipart/form-data",
//     },
//     data: {
//       image: image2,
//     },
//   })
//   .then((r) => {
//     console.log("nice!!"+r.data.faces);
//     console.log(Object.values(r.data.faces))
//     res.send(r.data.info.emotion);
//   })
//   .catch(function (err) {
//     console.log("hey,,,",err);

//     if(res.status(400)) { // 에러코드 400이라면
//       res.status(400).json({message: err.message})
//     } else if(res.status(500)){  // 에러코드 500이라면
//       res.status(500).json({message: err.message})
//     }
//   });
     
// });


// // 음성 변환 api
// async function quickstart() {
//   // The path to the remote LINEAR16 file
//   const gcsUri = 'gs://cloud-samples-data/speech/brooklyn_bridge.raw';

//   // The audio file's encoding, sample rate in hertz, and BCP-47 language code
//   const audio = {
//     uri: gcsUri,
//   };
//   const config = {
//     encoding: 'LINEAR16',
//     sampleRateHertz: 16000,
//     languageCode: 'en-US',
//   };
//   const request = {
//     audio: audio,
//     config: config,
//   };

//   // Detects speech in the audio file
//   const [response] = await client.recognize(request);
//   const transcription = response.results
//     .map(result => result.alternatives[0].transcript)
//     .join('\n');
//   console.log(`Transcription: ${transcription}`);
// }
// quickstart();