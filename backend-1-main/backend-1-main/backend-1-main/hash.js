const bcrypt = require("bcrypt");

const password = "@ralfphone";

bcrypt.hash(password, 10)
.then(hash => {
    console.log("Password:", password);
    console.log("Hash:", hash);
})
.catch(error => {
    console.error("Hash error:", error);
});