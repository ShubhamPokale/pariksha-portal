import React, { useState, useEffect, useRef } from 'react';
import "../../Style/StudentPanelStyle/ExamPanelStyle.css";
import { useNavigate, useLocation, useParams  } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import { FaceMesh } from "@mediapipe/face_mesh";
import * as cam from "@mediapipe/camera_utils";
import Webcam from "react-webcam";
import axios from 'axios';
import { useStudentAuth } from '../StudentAuth';


const ExamPanel = () => {
  const location = useLocation();
  const { state } = location;
  const { studentName, studentPrn } = state || {};

  const videoRef=useRef(); 
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [selectedAnswerStyle, setSelectedAnswerStyle] = useState({});
  const [timer, setTimer] = useState(900);
  const [warningCount, setWarningCount] = useState(-1);
  const [isCameraAllowed, setCameraAllowed] = useState(false);
  const [isMicrophoneAllowed, setMicrophoneAllowed] = useState(false);
  const [isNoiseHigh, setIsNoiseHigh] = useState(false);
  const [noiseWarningCount, setNoiseWarningCount] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isWebcamReady, setWebcamReady] = useState(false);
  const [refreshcam,setrefreshcam]=useState(0);
  const timeForFullScreen = useRef(null);
  const [OneFaceWarning,setOneFaceWarning]=useState(false);
  const [TwoFaceWarning,setTwoFaceWarning]=useState(false);
  const [examDuration,setexamDuration]=useState(0);
  const [examSchedule,setExmexamSchedule]=useState("");
  const [ExamName,setExamName]=useState("");
  const [timeRemainingToStart,stetimmerLessToStart]=useState(false);
  const [questionsData,setquestionsData] = useState([]);
  const { isStudentLoggedIn } = useStudentAuth();
  const navigate = useNavigate();
  const {examId}=useParams(); 

  if (!isStudentLoggedIn) {
    navigate(`/studentLogin/${examId}`);
  }

  //handling exam id from url to show exam related data from db

  useEffect(()=>{
  },[examId])
  //checking screen size of student
  const handleFullScreenClick = () => {
    if (!isFullScreen) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    };
    if (isFullScreen) {
      clearTimeout(timeForFullScreen.current);
    }
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('msfullscreenchange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullScreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
      document.removeEventListener('msfullscreenchange', handleFullScreenChange);
    };
  }, [isFullScreen]);

  useEffect(() => {
    if (!timeRemainingToStart) {
      return; 
    }

    if (!isFullScreen && warningCount>0) {
      timeForFullScreen.current = setTimeout(() => {
        handleSubmit();
      }, 6000);
    }
    return () => {
      clearTimeout(timeForFullScreen.current);
    };
  }, [isFullScreen]);
  
  //----------------------------------------------

  //Loading details of question paper

  useEffect(() => {
    const fetchData = async () => {
      try {
        const responseFromExamTable = await axios.get(`http://localhost:8080/api/getExamByExamId/${examId}`);
        setexamDuration(responseFromExamTable.data.examDuration);
        setExmexamSchedule(responseFromExamTable.data.examSchedule);
        setExamName(responseFromExamTable.data.examName);
      } catch (e) {
        console.error(e);
      }
    };
const examPaper=async()=>{
  try{
const examPaperResponse=await axios.get("http://localhost:8080/api/getAllQuestions");
console.log(examPaperResponse.data);
setquestionsData(examPaperResponse.data);
  }catch(e){
    console.log(e);
  }

}
    examPaper();
    fetchData(); 
  }, [isFullScreen]);


  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [timeOfStartingExam,settimeOfStartingExam]=useState(0);
  // ...
  useEffect(() => {
const calculateRemainingTime = () => {
      const currentTime = new Date();
      const examScheduleTime = new Date(examSchedule);
      const timeDifferenceInSeconds = Math.floor((currentTime - examScheduleTime) / 1000);
      const updatedRemainingTimeInSec = examDuration * 60 - timeDifferenceInSeconds;
      setRemainingMinutes(Math.floor(updatedRemainingTimeInSec / 60));
      setRemainingSeconds(updatedRemainingTimeInSec % 60);
      // If the remaining time is less than or equal to 0, automatically submit the exam
      if (updatedRemainingTimeInSec <= 0) {
        handleSubmit();
      }

//checking if exam is started or not
settimeOfStartingExam(Math.floor(updatedRemainingTimeInSec/60)-examDuration);
      if((updatedRemainingTimeInSec)/60 <= examDuration){
        stetimmerLessToStart(true);
      }
    };
    const intervalId = setInterval(calculateRemainingTime, 1000);
    return () => clearInterval(intervalId);
  }, [remainingMinutes, remainingSeconds, examSchedule, examDuration]);

  const [dataSent, setDataSent] = useState(false);
//Putting Data to active exam api
useEffect( ()=>{
  if (!timeRemainingToStart || dataSent) {
    return; 
  }
  const addToActiveExam=async()=>{
    try{
      if(examSchedule!=null){
        const examScheduleTime = new Date(examSchedule);
        const istOptions = { timeZone: 'Asia/Kolkata' };
        const istDateString = examScheduleTime.toLocaleString('en-US', istOptions);
      const responseActiveExam=await axios.post("http://localhost:8080/api/postActiveExamData",{
        examDate:istDateString,
        examName:ExamName,
        studentName:studentName,
        studentPrn:studentPrn
      });
    }
    setDataSent(true);
      }catch(e){
      console.log(e);
    }
      }
      addToActiveExam();

  console.log("ok");
        let count = 0;
        const intervalId = setInterval(() => {
          handlerefreshcam();
          count++;
          console.log(count);
          if (count === 3) {
            clearInterval(intervalId);
          }
        }, 3000);

},[warningCount])


//getting media of user


  let Submitcount=5;
useEffect(() => {

  if (!timeRemainingToStart) {
    return; 
  }

    const requestMediaPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }    
        setCameraAllowed(true);
        setMicrophoneAllowed(true);
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        //analysing microphone
        const checkNoise = () => {
          analyser.getByteFrequencyData(dataArray);
          const averageAmplitude = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
          const noiseThreshold = 444; // change this on need
          setIsNoiseHigh(averageAmplitude > noiseThreshold);
          if (averageAmplitude > noiseThreshold) {
            console.log("yes noise is high");
            setNoiseWarningCount((prevCount) => prevCount + 1);
          }

          requestAnimationFrame(checkNoise);
        };

        checkNoise();

      } catch (error) {
        console.error('Error accessing camera and microphone:', error);
      }
    };

    //checking permission camera and microphone
    const checkPermissionsAndInitialize = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setCameraAllowed(true);
        setMicrophoneAllowed(true);
        setWebcamReady(true);
        requestMediaPermissions();
      } catch (error) {
        console.error('Error accessing camera and microphone:', error);
      }
    };
    checkPermissionsAndInitialize();
  }, []);


  //if user leaves page
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      const message = 'You want to leave the page? Your progress may be lost.';
      event.returnValue = message;
      return message;
    };

    //if user changes visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setWarningCount((prevCount) => prevCount + 1);
        alert('Warning!!!!  Exam Tab was not open');
        // changes made
        const timeoutId = setTimeout(() => {
          handleSubmit();
        }, 4000);
        const clearTimer = () => {
          clearTimeout(timeoutId);
        };
        document.addEventListener('visibilitychange', clearTimer);
        setTimeout(() => {
          document.removeEventListener('visibilitychange', clearTimer);
        }, 4000);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  //auto submmit over exccess warning
  useEffect(() => {
    if (warningCount === 10) {
      alert('Automatic submission due to excessive warnings.');
      handleSubmit();
    }
  }, [warningCount]);

  useEffect(() => {
    if (noiseWarningCount === 10) {
      alert('Automatic submission due to excessive warnings.');
      handleSubmit();
    }
  }, [noiseWarningCount]);

  const handleQuestionClick = (index) => {
    setCurrentQuestionIndex(index);
  };

  const handleAnswerSelect = (answer) => {
    setSelectedAnswers((prevSelectedAnswers) => ({
      ...prevSelectedAnswers,
      [currentQuestionIndex]: answer,
    }));

    setSelectedAnswerStyle((prevSelectedAnswerStyle) => ({
      ...prevSelectedAnswerStyle,
      [currentQuestionIndex]: 'green',
    }));
    const listItems = document.querySelectorAll('.question-list li');
    listItems[currentQuestionIndex].style.backgroundColor = 'green';
  };
  
  const handleSubmit = async() => {
    const correctAnswersCount = questionsData.reduce((count, question, index) => {
      const selectedAnswer = selectedAnswers[index];
      const correctAnswer = question.answer; // Assuming you have a property named 'correctAnswer' in your question data
      if (selectedAnswer === correctAnswer) {
        return count + 1;
      }
      return count;
    }, 0);

try{
  const examScheduleTime = new Date(examSchedule);
  const istOptions = { timeZone: 'Asia/Kolkata' };
  const istDateString = examScheduleTime.toLocaleString('en-US', istOptions);
const saveStudentData=axios.post("http://localhost:8080/api/postStudentResultData",{
  studentName:studentName,
  studentPrn:studentPrn,
  studentResultDownloadLink:"abc/test",
  studentMarks:correctAnswersCount,
  examName:ExamName,
  examDate:istDateString,
  examId:examId
})
console.log(saveStudentData.data);
}catch(e){
  console.log(e);
}
try{
const deletActiveStudent=axios.delete(`http://localhost:8080/api/deleteActiveExamByStudentPrn/${studentPrn}`);
}catch(e){
console.log(e);
}
    navigate("/examsuccess");
  };

  useEffect(() => {
    if (timer <= 0) {
      handleSubmit();
    }
  }, [timer]);

   //handleFinalSubmit
  const handleFinalSubmit = () => {
    const confirmSubmit = window.confirm('Do you want to submit the exam?');

    if (confirmSubmit) {
      handleSubmit();
    }
  };

  useEffect(() => {

    const handleResize = () => {
      setWarningCount((prevCount) => prevCount + 1);
    };
  
    window.addEventListener('resize', handleResize);
  
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);


  //for camera
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  let camera = null;

  const handlerefreshcam =()=>{
    setrefreshcam((pre)=>pre+1);
      }
   

  useEffect(() => {

    if (!timeRemainingToStart) {
      return; 
    }

    const initializeCameraAndFaceMesh = async () => {
      const faceMesh = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        },
      });

      faceMesh.setOptions({
        maxNumFaces: 50,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults(onResults);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setCameraAllowed(true);
        setMicrophoneAllowed(true);
        setWebcamReady(true);

        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
        }

       const onFrame= async () => {
         if (webcamRef.current) {
    await faceMesh.send({ image: webcamRef.current.video });
  }
        },
        camera = new cam.Camera(webcamRef.current?.video, {
          onFrame,
          width: 640,
          height: 480,
        });

        camera.start();
      } catch (error) {
        console.error('Error accessing camera and microphone:', error);
      }
    };

    if (webcamRef.current) {
      initializeCameraAndFaceMesh();
    }
  }, [refreshcam]);

  const timerRef = useRef(null);
  const timerRef2 = useRef(null);
  const onResults = (results) => {
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;
  
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;
  
    const canvasElement = canvasRef.current;
    const canvasCtx = canvasElement.getContext("2d");
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasElement.width,
      canvasElement.height
    );

    
    if (results.multiFaceLandmarks) {
      if(results.multiFaceLandmarks.length>1){
        setTwoFaceWarning(true);  
        if (!timerRef2.current) {
          timerRef2.current = setTimeout(() => {
            handleSubmit();
            timerRef2.current = null;
          }, 10000); 
        }
      }else{
        setTwoFaceWarning(false);
        if (timerRef2.current) {
          clearTimeout(timerRef2.current);
          timerRef2.current = null;
        }
      }

      if(results.multiFaceLandmarks.length<=0){
        setOneFaceWarning(true);
        if (!timerRef.current) {
          timerRef.current = setTimeout(() => {
            handleSubmit();
            timerRef.current = null;
          }, 10000); 
        }
      }else{
        setOneFaceWarning(false);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }

    }
  };
////////////////////////////////////////////////////////////////////////////
return (
    <div>
   
    {!timeRemainingToStart ? (
   isNaN(timeOfStartingExam) ? (<div className='examNotStarted'>There is no exam</div>):(
    <div className='examNotStarted'>Exam Is Not Started Yet !!!! come back in {timeOfStartingExam} Minutes</div>
   )   
    ):(  
    <div className={`exam-panel ${isFullScreen ? 'full-screen' : ''}`}>
      {isFullScreen ? (
        <div>
        <div className="header">
        <div className="timer">
  Timer: {String(remainingMinutes).padStart(2, '0')}:{String(remainingSeconds).padStart(2, '0')} minutes
</div>
          <div className='warningCount'> Warning count: {warningCount} NoiseCount: {noiseWarningCount} </div>
          <div className="student-info">
            {studentName} - PRN: {studentPrn}
          </div>
        </div>      
        <div className="question-list">
        {questionsData.length>0 ?(  
        <ul>
          {questionsData.map((question, index) => (
            <li
              key={question.id}
              onClick={() => handleQuestionClick(index)}
              className={index === currentQuestionIndex ? 'active' : ''}
            >
              {index + 1}
            </li>
          ))}
        </ul>):(
            <div>Loading questions...</div>
        )
}
      </div>

{
  OneFaceWarning && (<div className='noFace'>Warning!!!!!!! No Face on camera</div>) 
}
{
    TwoFaceWarning && (<div className='noFace'>Warning!!!!!!! Multiple Faces on camera</div>) 
}


      <div className="question-container">

    {questionsData.length > 0 ? (
  <div>
    <h3> {currentQuestionIndex + 1} - {questionsData[currentQuestionIndex].question}</h3>
    <div className="answer-options">
      {['optionA', 'optionB', 'optionC', 'optionD'].map((option, index) => (
        <label key={index}>
          <input className='answerInput'
            type="radio"
            name={`answer-${currentQuestionIndex}`}
            value={questionsData[currentQuestionIndex][option]}
            checked={selectedAnswers[currentQuestionIndex] === questionsData[currentQuestionIndex][option]}
            onChange={() => handleAnswerSelect(questionsData[currentQuestionIndex][option])}
          />
          {questionsData[currentQuestionIndex][option]}
        </label>
      ))}
    </div>
    <div className='button-save-next'>
      <button className='btn1' onClick={() => handleQuestionClick(Math.max(currentQuestionIndex - 1, 0))}>
        Previous!!
      </button>
      <button className='btn2' onClick={() => handleQuestionClick(Math.min(currentQuestionIndex + 1, questionsData.length - 1))}>
        Next!!
      </button>
    </div>
  </div>
) : (
  <div>Loading questions...</div>
)}
      </div>

   <div className="submit-button">
        <button onClick={handleFinalSubmit}>Submit Exam</button>
      </div>

      <div className='button-warning'>
        Warning!!! Do not Click on Submit Button before giving answers to all questions.
      </div>
     
  <center  className="small-screen"> 
<button className="refCambutton" onClick={handlerefreshcam}>Refresh Cam</button>
          <div >
            <Webcam
              ref={webcamRef}
              style={{
                textAlign: "center",
                zIndex: 9,
                width: "300px",
                height: "auto",
                display: "none",
              }}
            />
            <canvas
              ref={canvasRef}
              className="output_canvas"
              style={{
                zIndex: 9,
                width: "300px",
                height: "auto",
              }}
            ></canvas>
          </div>
        </center>
</div>
      ) : (
        <div className='before-screen'>     
        <div className="fullscreen-button">
        <br></br>
          <button  onClick={handleFullScreenClick}>Enter Full Screen</button>  
          <p> Click on the designated "Enter Full Screen" button to optimize your exam view. Failure to do so may affect your ability to start the exam. Additionally, grant permission for both the camera and microphone when prompted, as these are essential for exam monitoring.
             Good luck!</p>
        </div>
        </div>
      )}
    </div>
)}
   </div>
  );
};

export default ExamPanel;
