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

});

//이메일 변경
app.post('/changeEmail', (req, res) => {
  let id = req.query.id;
  let email = req.query.email;
  let values = [email, id]
  
  console.log(values);

  const sql = "UPDATE userInfo SET email = ? Where id = ?";
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

});

//비밀번호 맞는지 확인
app.post('/pwCheck', (req, res) => {
  console.log("비밀번호 확인하러 옴")
  let id = req.query.id;
  let pw = crypto.createHash("sha512").update(req.query.pw).digest("base64");
  let values = [id, pw];
  
  const sql = "Select email From userInfo Where id = ? AND pw = ?";
  db.query(sql, values,
  (err, result) => {
    if(err){
      console.log(err);
    }
    if(result.length > 0){
      console.log(result);
      res.send("0");
    }else {
      res.send("1");
    }
    

});
});


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
  console.log("글 작성 하러 옴");
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
  let score;
  let big;


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
  .then(async(r) => {
    console.log("nice!!",r.data.document);
    emotion = r.data.document.sentiment;
    console.log("감정: ",r.data.document);
    positive = (r.data.document.confidence.positive).toFixed(1);
    negative = (r.data.document.confidence.negative).toFixed(1);
    neutral = (r.data.document.confidence.neutral).toFixed(1);
    big = Math.max(positive, negative, neutral);
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

  let sql3 = "select score from userInfo where id =?";
  db.query(sql3, id, (err, result) => {
    let tempScore = result[0].score;

    if (err) console.log(err);
    else {
      if (emotion === "positive") {
        score = tempScore + big / 10;
        console.log("positive", score);
      } else if (emotion === "negative") {
        score = tempScore - big / 10;
        console.log("negative", score);
      } else if (emotion === "neutral") {
        if (big === 100) {
          //neutral이 100이면 짧은 글이라서 감정 분석이 제대로 안 된 글임
          score = score;
        } else if (score >= 50) {
          score = tempScore + big / 15;
          console.log("neutral", score);
        } else if (score < 50) {
          score = tempScore - big / 15;
          console.log("neutral", score);
        }
      }
    }
  });

  setTimeout(() => {
    let values = [id, title, content, year, month, day, img, voice, keyword, emotion, positive, negative, neutral]
    const sql = "INSERT INTO diary(id, title, content, year, month, day, img, voice, keyword, emotion, positive, negative, neutral) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    const sql2 = "Update userInfo Set score = ? Where id = ?";
    let values2 = [score, id];
    console.log("ㅅㅂ",values2);

    db.query(sql, values, (err, result) => {
      if (err) {
        console.log(err);
      } else {
        db.query(sql2, values2, (err, result) => {
          if (err) {
            console.log(err);
          } else {
            res.send(result);
          }
        });
      }
    });
  }, 500)

});





//사용자 일기 내용 반환 (일반 목록 리스트)
app.post('/myDiary',(req, res) => {
  console.log("일로 옴");
  let id = req.query.id;
  let year = req.query.year;

  let values = [id, year];
  console.log(values);
  
  const sql= "Select diarykey, title, content, year, month, day, img, voice, keyword, emotion From diary Where id = ? AND year =? Order By day DESC";

  db.query(sql, values,
    (err, result) => {
    //  console.log(result)
        if (err)
            console.log(err);
        else
        // console.log(result);
        res.send(result);
    });
});

//사용자 일기 내용 반환 (공유 일기 리스트)
app.post('/myShare',(req, res) => {
  console.log("공유하러 옴");
  let id = req.query.id;
  let year = req.query.year;

  let values = [id, year, "true"];
  console.log(values);
  const sql= "Select diarykey, title, content, year, month, day, img, voice, keyword, emotion From diary Where id = ? AND year = ? AND shareCheck = ?"
  

  db.query(sql, values,
    (err, result) => {
     console.log(result)
        if (err) {
            console.log(err);
        }else {
        res.send(result);
        
        }
    });
});


//사용자 일기 수정
app.post('/diaryModify', async function(req, res) {
  console.log("수정하러 옴");
  let diarykey = req.query.diarykey;
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
    console.log("수정 nice!!",r.data.document);
    emotion = r.data.document.sentiment;
    console.log("감정: ",r.data.document);
    positive = (r.data.document.confidence.positive).toFixed(1);
    negative = (r.data.document.confidence.negative).toFixed(1);
    neutral = (r.data.document.confidence.neutral).toFixed(1);
  })
  .catch(function (err) {  
    console.log("hey,,,?",err);

    if(res.status(400)) { // 에러코드 400이라면
      res.status(400).json({message: err.message})
    } else if(res.status(500)){  // 에러코드 500이라면
      res.status(500).json({message: err.message})
    }
  });

  let values = [title, content, year, month, day, img, voice, keyword, emotion, positive, negative, neutral, diarykey];
  console.log(values);
  const sql = "Update diary Set title = ?, content = ?, year = ?, month = ? , day = ?, img = ?, voice = ?, keyword = ?, emotion = ?, positive = ?, negative = ?, neutral = ? Where diarykey = ?"

  db.query(sql, values,
    (err, result) => {
        if (err)
            console.log(err);
        else
            res.send(result);
    });
})


//사용자 일기 삭제
app.post('/diaryDelete', (req,res) => {
  console.log("삭제하러옴")
  let diarykey = req.query.diarykey;
  let imgKey = req.query.imgKey;

  console.log("imgKey", imgKey)

  let values = [diarykey];
  
  //s3에 저장된 이미지 삭제
  s3.deleteObject({
    Bucket: 'sodam-s3',
    Key: imgKey,
  }, (err, data) => {
    if(err) {
      console.log(err);
    }else {
      console.log(data);
    }
  }
  );

  const sql = "Delete From diary Where diarykey = ?"
  db.query(sql, values, (err, result) => {
    if(err) {
      console.log(err);
    }else {
      res.send(result);
    }
  });
});


//사용자 일기내용 반환(상세페이지)
app.post('/diaryInfo', (req, res) => {
  let diarykey = req.query.diarykey;

  let values = [diarykey];
  let sql = "Select title, content, year, month, day, img, voice, keyword, emotion From diary Where diarykey =?"
  db.query(sql, values, (err, result) => {
    if(err) {
      console.log(err);
    }
  else {
      res.send(result);
    }
})
});


//앨범
app.post('/album', (req, res) => {
  console.log("앨범");
  let id = req.query.id;
  let values = [id];

  let sql = "select diarykey, img From diary Where id =?"
  db.query(sql, values, (err, result) => {
    if(err) {
      console.log(err);
    }else {
      res.send(result);
    }
  })

});

//일기 공유 버튼 선택 시
app.post('/sharePush', (req, res) => {
  let diarykey = req.query.diarykey;
  
  let value = [diarykey];
  let values = ["false", diarykey];
  let sql = "INSERT INTO shareCard SELECT * FROM diary WHERE diary.diarykey = ?"
  let sql2 = "Update diary Set shareCheck = ? Where diarykey = ?"
  console.log(diarykey);
  //공유 일기 테이블에 일기 복사
  db.query(sql, value, (err, result) => {
    if(err) {
      console.log(err);
    }else{
      //일기가 복사 됐다면 기존 일기 테이블에서 shareCheck값 false로 변경
      db.query(sql2, values, (err, result) => {
        if(err) {
          console.log(err);
        }else {
          res.send(result);
        }
      })
    };
  })

});

//일기 공유 시 해당 감정에 해당하는 일기만 반환 (리스트)
app.post('/shareList', (req, res) => {
  let diarykey = req.query.diarykey;
  
  let sql = "Select positive, negative, neutral From diary Where diarykey = ?";
  let values = [diarykey];
  console.log(values);
  
  db.query(sql, values, (err, result) => {
    if(err) {
      console.log(err);
    }else {
      res.send(result);
    }
  });
  
})

//일기 공유 시 감정 반환
app.post('/shareList2', (req, res) => {
  let id = req.query.id;
  let emotion = req.query.emotion;
  let emotionValue = req.query.emotionValue;
  let sql;

  if(emotion === 'neutral') {
    sql= "Select diarykey, title, content, year, month, day, img, voice, keyword, emotion From shareCard Where id != ? AND neutral Between ?-20 AND ?+20"
  }else if(emotion === 'positive') {
    sql= "Select diarykey, title, content, year, month, day, img, voice, keyword, emotion From shareCard Where id != ? AND positive Between ?-20 AND ?+20"
  }else if(emotion === 'negative') {
    sql= "Select diarykey, title, content, year, month, day, img, voice, keyword, emotion From shareCard Where id!=? AND negative Between?-20 AND ?+20"
  }
  
  let values = [id, emotionValue, emotionValue];

  db.query(sql, values, (err, result) => {
    if(err) {
      console.log(err);
    }else {
      res.send(result);
    }
  })
  
});

//일기 초기화
app.post('/deleteAll', (req, res) => {
  console.log("일기 초기화하러 옴");
  let id = req.query.id;
  let values = [id];

  let sql = "delete from diary where id =?";
  db.query(sql, values, (err, result) => {
    if(err) {
      console.log(err);
    }else {
      res.send(result);
    }
  })
});

//계정 탈퇴
app.post('/withdrawal', (req, res) => {
  console.log("계정 탈퇴하러 옴");
  let id = req.query.id;
  let values = [id];

  let sql = "delete From diary where id =?"; 
  let sql2 = "delete From userInfo Where id =?";

  db.query(sql, values, (err, result) => {
    if(err) {
      console.log(err);
    }else {
      db.query(sql2, values, (err, result) => {
              if(err) {
                console.log(err);
              }else {
                res.send(result);
              }
            });
    }
  });
});

//계정 점수 반환
app.post('/userScore', (req, res) => {
  console.log("계정 점수");
  let id = req.query.id;
  let values = [id];

  let sql = "select score from userInfo where id =?";
  db.query(sql, values, (err, result) => {
    if(err) {
      console.log(err);
    }else {
      console.log(result);

      res.send(result);
    }
  })
});

//감정 횟수 반환
app.post('/count', (req, res) => {
  let id = req.query.id;
  let count = [];
  
  let values = [id];
  
  let sql = "select Count(emotion) as count From diary where id =? AND emotion = positive";
  let sql2 = "select Count(emotion) as count From diary where id =? AND emotion = negative";
  let sql3 = "select count(emotion) as count from diary where id =? AND emotion = neutral";
  
  db.query(sql, values, (err, result) => {
    if(err) {
      console.log(err);
    }else {
      count[0] = result;
      console.log("0",result);
      db.query(sql2, values, (err, result) => {
        if(err) {
          console.log(err);
        }else {
          count[1] = result;
          console.log("1",result);
          db.query(sql3, values, (err, result) => {
            if(err) {
              console.log(err);
            }else {
              count[2] = result;
              console.log("2",result);
              res.send(count);
            }
          });
        }
      });
    }
  });

});

//키워드 막대차트
app.post('/chart/bar', (req, res) => {
  let id = req.query.id;

  const sql = "SELECT keyword, count(keyword) as cnt FROM diary WHERE id=? GROUP BY keyword ORDER BY count(keyword) DESC LIMIT 5;"
  db.query(sql, id,
    (err, result) => {
        if (err)
            console.log(err);
        else
            res.send(result);
    });
})

//일기 통계
app.post('/chart/contribution',(req, res) => {
  let id = req.query.id;
  const sql= "SELECT CONCAT_WS('-', year, LPAD(month, 2, 0) , LPAD(day, 2, 0)) as date, 5 as count FROM diary WHERE id=?"

  db.query(sql, id,
    (err, result) => {
     console.log(result)
        if (err)
          res.send(err);
        else
        // console.log(result);
        res.send(result);
    });
});
