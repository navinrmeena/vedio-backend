import {asyncHandler} from '../utils/asyncHandler.js';
import { User } from '../models/user.models.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {ApiError} from '../utils/ApiError.js'

// const registerUser=asyncHandler(async (req,res)=>{
//     res.status(500).json({
//         message:"chai aur code",
//     })
// })


const genrateAccestokenAndRefreshTokens=async(userId)=>{
    try {
        const user=await User.findById(userId)
        const accessToken=user.genrateAccestoken()
        const refreshToken=user.genrateRefreshtoken()

        // now we have genrated token we have to save it to user so
        user.refreshToken=refreshToken
        // now we added refreshToken but we have to save it soo
        await user.save({validateBeforeSave : false})   //by this line we can save but every time we save 
        // we need password to validate so {validateBeforeSave : false} it will skip validation 

        return {accessToken, refreshToken}
         
    } catch (error) {
        throw new ApiError(500,"something went wrong while genrating acces Tokens and refresh Tokens")
    }
}

const registerUser=asyncHandler(async (req,res)=>{
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    
    const {fullName,email, username ,password}=req.body
    // console.log("email",email);

    if(
        [fullName,email, username ,password].some((field)=>
    field?.trim()==="")
    ){
        throw new ApiError(400,"All field is required ");
    }

    const  existedUser= await User.findOne(
        {
            $or:[{username},{email}]
        }
    )
    if(existedUser){
        throw new ApiError(409,"user with same username or email exist ")
    }
    
    const avatarlocalpath=req.files?.avatar[0]?.path;
    // this give path from multer where file is stored
    
    // const coverImagelocalPath=req.files?.coverImage[0]?.path;  
    // but is thire is no local path input given from fronthend then we have to chek that it must not be undefine  

    
    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
   

    if(!avatarlocalpath){
        throw new  ApiError(400,"avatar file is required ")
    }

    const avatar=await uploadOnCloudinary(avatarlocalpath);
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"avatar file is required ")
    }

    const user=await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url||"",
        email,
        password,
        username:username.toLowerCase()
    })
    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"something went wrong while user registration  ")
    }

    return res.status(201).json(
       new ApiResponse(200,createdUser,"user registered sucsesfully ")
    )

})

const loginUser=asyncHandler(async(req,res)=>{
    // ask for user name and password,
    // check if user exists
    // take passwrod and send it to encripter and match with data base password 
    // if match then allow user to log in 
    // and give acces token 


        // 1. req body => data
        // 2. username ,email
        // 3. find user 
        // 4. acess token and refresh token
        // 5. send cookie 

   const {email ,username,password}= req.body 
   if(!username&&!email){
    throw new ApiError(400,"username or email required")
   }

   const user = await User.findOne({
    $or:[{username},{email}]
   })

   if(!user){
    throw new ApiError(404,"user doesnot  exits")
   }

   const isPasswordValid= await user.isPasswordCorrect(password);

   if(!isPasswordValid){
    throw new ApiError(401,"password invalid") 
   }
   const {accessToken,refreshToken}=await genrateAccestokenAndRefreshTokens(user._id)

   const logedinuser=await User.findById(user._id).select("-password -refreshToken")

   const options={
    httpOnly:true,
    // while we send cookie we degine ootin 
    // when we add this both option httpOnly,secure true then coookie is only modified by server not by front end
    secure:true
   }
   return res.status(200)
   .cookie("accessToken",accessToken,options)
   .cookie("refreshToken",refreshToken,options)
   .json(
    new ApiResponse(200,{
        user: logedinuser,accessToken,refreshToken
    },
    "user loggedin ")
    )

})




const logoutUser=asyncHandler(async(req,res)=>{
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )

    const options={
        httpOnly:true,
        // while we send cookie we degine ootin 
        // when we add this both option httpOnly,secure true then coookie is only modified by server not by front end
        secure:true
       }
        
       return res
       .status(200)
       .clearCookie("accessToken",options)
       .clearCookie("refreshToken",options)
       .json(new ApiResponse(200,{},"user logged out "))
})


export  {
    registerUser,
    loginUser,
    logoutUser
}


