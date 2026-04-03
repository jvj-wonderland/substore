package substoreserver

type Protocol struct {
	Server string
	Port   int
	UDP    bool
}

type Shadowsocks struct {
	Protocol
	Cipher   string
	Password string
}
