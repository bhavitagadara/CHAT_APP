const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination : (req, file ,cd) => {
        cd(null, 'upload/');
    },
    filename:(req, file , cd)=>{
        cd( null , Date.now() +  path.extname(file.originalname));
    }
})

const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/png", "image/jpeg", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"), false);
    }
  };


  const upload = multer({ storage: storage, fileFilter: fileFilter });

module.exports = upload;