const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const {
    generateMessage, 
    generateLocation 
} = require('./utils/messages')
const {
    addUser,
    removeUser,
    getUser,
    getUsersInRoom
} = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000

const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

io.on('connection', (socket) => {
    console.log('New WS connection');

    socket.on('join', ({ username, room }, callback) => {
        const { error, user } = addUser({
            id: socket.id,
            username,
            room
        })

        if (error) {
            return callback(error)
        }

        socket.join(user.room)

        socket.emit('message', generateMessage('Chat Bot', 'Welcome'))
        socket.broadcast.to(user.room).emit('message', generateMessage('Chat Bot', `${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id)
        
        const filter = new Filter()

        if(filter.isProfane(message)) {
            return callback('Warning: stop swearing!')
        }

        io.to(user.room).emit('message', generateMessage(user.username, message))
        callback()
    })

    socket.on('sendLocation', ({ latitude, longitude }, callback) => {
        const user = getUser(socket.id)
        const url = `https://google.com/maps?q=${latitude},${longitude}`

        io.to(user.room).emit('locationMessage', generateLocation(user.username, url))

        callback()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Chat Bot', `${user.username} has left`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {
    console.log(`Server is up on port ${port}`);
})