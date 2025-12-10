
<?php

        $hostname     = 'localhost';
        $username     = 'root';
        $password     = '';
        $database     = 'gamehub';
       
 $conn = mysqli_connect($hostname, $username, $password, $database);

    if (!$conn) {
        die("Connection échouée : " . mysqli_connect_error());
    }


?>