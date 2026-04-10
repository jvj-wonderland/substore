package fennel

import (
	_ "embed"
	"fmt"
	"sync"

	lua "github.com/yuin/gopher-lua"
)

//go:embed lua/fennel-1.6.1.lua
var fennelSource string

type Pool struct {
	pool sync.Pool
}

func NewPool() *Pool {
	return &Pool{
		pool: sync.Pool{
			New: func() any {
				L := lua.NewState()
				// Fennel expects arg table to be present
				L.SetGlobal("arg", L.NewTable())

				if err := L.DoString(fennelSource); err != nil {
					panic(fmt.Errorf("failed to load fennel: %v", err))
				}

				// The fennel script returns the fennel module
				fennel := L.Get(-1)
				if fennel.Type() != lua.LTTable {
					panic(fmt.Errorf("failed to capture fennel module: got %s", fennel.Type().String()))
				}

				L.SetGlobal("fennel", fennel)
				L.Pop(1)
				return L
			},
		},
	}
}

func (p *Pool) Get() *lua.LState {
	return p.pool.Get().(*lua.LState)
}

func (p *Pool) Put(L *lua.LState) {
	p.pool.Put(L)
}

func Compile(L *lua.LState, script string) (string, error) {
	fennel := L.GetGlobal("fennel")
	compileString := L.GetField(fennel, "compile-string")

	err := L.CallByParam(lua.P{
		Fn:      compileString,
		NRet:    1,
		Protect: true,
	}, lua.LString(script))

	if err != nil {
		return "", err
	}

	ret := L.Get(-1)
	L.Pop(1)
	return ret.String(), nil
}

func EvalWithOutput(L *lua.LState, script string) (lua.LValue, string, string, error) {
	fennel := L.GetGlobal("fennel")
	eval := L.GetField(fennel, "eval")

	// Capture stdout by overriding 'print'
	var out []byte
	oldPrint := L.GetGlobal("print")
	L.SetGlobal("print", L.NewFunction(func(L *lua.LState) int {
		top := L.GetTop()
		for i := 1; i <= top; i++ {
			out = append(out, []byte(L.Get(i).String())...)
			if i < top {
				out = append(out, '\t')
			}
		}
		out = append(out, '\n')
		return 0
	}))
	defer L.SetGlobal("print", oldPrint)

	// Capture stderr if possible (Fennel uses io.stderr:write)
	// We can try to override io.stderr with a custom table that has a write method
	var errOut []byte
	ioTbl := L.GetGlobal("io")
	var oldStderr lua.LValue
	if ioTbl.Type() == lua.LTTable {
		oldStderr = L.GetField(ioTbl, "stderr")
		customStderr := L.NewTable()
		L.SetField(customStderr, "write", L.NewFunction(func(L *lua.LState) int {
			top := L.GetTop()
			// First arg is the table (self)
			for i := 2; i <= top; i++ {
				errOut = append(errOut, []byte(L.Get(i).String())...)
			}
			return 0
		}))
		L.SetField(ioTbl, "stderr", customStderr)
	}
	defer func() {
		if ioTbl.Type() == lua.LTTable {
			L.SetField(ioTbl, "stderr", oldStderr)
		}
	}()

	err := L.CallByParam(lua.P{
		Fn:      eval,
		NRet:    1,
		Protect: true,
	}, lua.LString(script))

	if err != nil {
		return nil, string(out), string(errOut), err
	}

	ret := L.Get(-1)
	L.Pop(1)
	return ret, string(out), string(errOut), nil
}

func Eval(L *lua.LState, script string) (lua.LValue, error) {
	val, _, _, err := EvalWithOutput(L, script)
	return val, err
}

func ToFennel(L *lua.LState, v any) (string, error) {
	fennel := L.GetGlobal("fennel")
	view := L.GetField(fennel, "view")

	lVal := MapToLua(L, v)

	err := L.CallByParam(lua.P{
		Fn:      view,
		NRet:    1,
		Protect: true,
	}, lVal)

	if err != nil {
		return "", err
	}

	ret := L.Get(-1)
	L.Pop(1)
	return ret.String(), nil
}

// MapToGo converts a gopher-lua LValue to a Go value.
func MapToGo(v lua.LValue) any {
	switch v.Type() {
	case lua.LTNil:
		return nil
	case lua.LTBool:
		return bool(v.(lua.LBool))
	case lua.LTNumber:
		return float64(v.(lua.LNumber))
	case lua.LTString:
		return string(v.(lua.LString))
	case lua.LTTable:
		tbl := v.(*lua.LTable)
		// Check if it's an array-like table
		if tbl.MaxN() > 0 {
			ret := make([]any, 0, tbl.MaxN())
			for i := 1; i <= tbl.MaxN(); i++ {
				ret = append(ret, MapToGo(tbl.RawGetInt(i)))
			}
			return ret
		}
		// Otherwise treat as map
		ret := make(map[string]any)
		tbl.ForEach(func(k, v lua.LValue) {
			ret[k.String()] = MapToGo(v)
		})
		return ret
	default:
		return v.String()
	}
}

// MapToLua converts a Go value to a gopher-lua LValue.
func MapToLua(L *lua.LState, v any) lua.LValue {
	switch val := v.(type) {
	case nil:
		return lua.LNil
	case bool:
		return lua.LBool(val)
	case float64:
		return lua.LNumber(val)
	case int:
		return lua.LNumber(val)
	case int64:
		return lua.LNumber(val)
	case string:
		return lua.LString(val)
	case []any:
		tbl := L.NewTable()
		for i, item := range val {
			tbl.RawSetInt(i+1, MapToLua(L, item))
		}
		return tbl
	case []map[string]any:
		tbl := L.NewTable()
		for i, item := range val {
			tbl.RawSetInt(i+1, MapToLua(L, item))
		}
		return tbl
	case map[string]any:
		tbl := L.NewTable()
		for k, v := range val {
			tbl.RawSetString(k, MapToLua(L, v))
		}
		return tbl
	default:
		// Fallback for types not explicitly handled
		return lua.LString(fmt.Sprintf("%v", v))
	}
}
